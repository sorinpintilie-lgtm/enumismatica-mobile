
import * as admin from "firebase-admin";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";

// Initialize Firebase Admin SDK
// Uses default credentials which are automatically available in Cloud Functions environment
admin.initializeApp();

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CREDIT_PRICE_RON = 1;

// Stripe configuration
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";

type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";

interface StripePaymentDoc {
  userId: string;
  status: PaymentStatus;
  ronAmount: number;
  creditsToAdd: number;
  paymentReference: string;
  provider: "stripe";
  stripePaymentIntentId: string;
  stripeClientSecret: string;
  createdAt: FirebaseFirestore.FieldValue;
  updatedAt: FirebaseFirestore.FieldValue;
  completedAt?: FirebaseFirestore.FieldValue;
}

function calcCreditsFromRon(ronAmount: number): number {
  if (!ronAmount || ronAmount <= 0) return 0;
  return Math.floor(ronAmount / CREDIT_PRICE_RON);
}

/**
 * Create a Stripe PaymentIntent for credit purchase
 */
export const createStripePaymentIntentCallable = onCall({region: "europe-west1"}, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Missing auth");
  }

  const uid = request.auth.uid;
  const ronAmountRaw = Number((request.data as any)?.ronAmount);
  if (!Number.isFinite(ronAmountRaw) || ronAmountRaw <= 0) {
    throw new HttpsError("invalid-argument", "Invalid ronAmount");
  }

  const ronAmount = Math.round(ronAmountRaw * 100) / 100;
  const creditsToAdd = calcCreditsFromRon(ronAmount);
  if (creditsToAdd <= 0) {
    throw new HttpsError("invalid-argument", "Amount too small for at least 1 credit");
  }

  if (!STRIPE_SECRET_KEY) {
    throw new HttpsError("failed-precondition", "Stripe is not configured");
  }

  try {
    // Create Stripe PaymentIntent
    const stripeResponse = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        amount: String(Math.round(ronAmount * 100)), // Stripe expects amount in smallest currency unit (bani for RON)
        currency: "ron",
        automatic_payment_methods: JSON.stringify({enabled: true}),
        metadata: JSON.stringify({
          userId: uid,
          creditsToAdd: String(creditsToAdd),
        }),
      }).toString(),
    });

    if (!stripeResponse.ok) {
      const errorText = await stripeResponse.text();
      logger.error("Stripe PaymentIntent creation failed", {
        status: stripeResponse.status,
        error: errorText,
      });
      throw new HttpsError("internal", "Failed to create payment intent");
    }

    const paymentIntent = await stripeResponse.json() as any;
    const paymentIntentId = paymentIntent.id;
    const clientSecret = paymentIntent.client_secret;

    // Store payment record in Firestore
    const paymentsCol = admin.firestore().collection("creditPayments");
    const paymentRef = paymentsCol.doc();
    const paymentReference = `stripe_${paymentRef.id}`;

    const docData: StripePaymentDoc = {
      userId: uid,
      status: "pending",
      ronAmount,
      creditsToAdd,
      paymentReference,
      provider: "stripe",
      stripePaymentIntentId: paymentIntentId,
      stripeClientSecret: clientSecret,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await paymentRef.set(docData);

    return {
      paymentIntentId,
      clientSecret,
      paymentReference,
      amount: ronAmount,
      currency: "RON",
    };
  } catch (error: any) {
    logger.error("createStripePaymentIntentCallable failed", {error: error?.message || error});
    throw new HttpsError("internal", error?.message || "Failed to create payment intent");
  }
});

/**
 * Confirm a Stripe payment and credit the user
 */
export const confirmStripePaymentCallable = onCall({region: "europe-west1"}, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Missing auth");
  }

  const uid = request.auth.uid;
  const paymentIntentId = String((request.data as any)?.paymentIntentId || "").trim();
  if (!paymentIntentId) {
    throw new HttpsError("invalid-argument", "paymentIntentId is required");
  }

  if (!STRIPE_SECRET_KEY) {
    throw new HttpsError("failed-precondition", "Stripe is not configured");
  }

  try {
    // Retrieve PaymentIntent from Stripe
    const stripeResponse = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
      },
    });

    if (!stripeResponse.ok) {
      const errorText = await stripeResponse.text();
      logger.error("Stripe PaymentIntent retrieval failed", {
        status: stripeResponse.status,
        error: errorText,
      });
      throw new HttpsError("internal", "Failed to retrieve payment intent");
    }

    const paymentIntent = await stripeResponse.json() as any;
    const stripeStatus = paymentIntent.status;

    // Find the payment record
    const paymentsQuery = await admin.firestore()
      .collection("creditPayments")
      .where("stripePaymentIntentId", "==", paymentIntentId)
      .where("userId", "==", uid)
      .limit(1)
      .get();

    if (paymentsQuery.empty) {
      throw new HttpsError("not-found", "Payment record not found");
    }

    const paymentDoc = paymentsQuery.docs[0];
    const paymentData = paymentDoc.data();

    // Map Stripe status to our status
    let mappedStatus: PaymentStatus;
    if (stripeStatus === "succeeded") {
      mappedStatus = "paid";
    } else if (stripeStatus === "canceled") {
      mappedStatus = "cancelled";
    } else if (["requires_payment_method", "requires_confirmation", "requires_action"].includes(stripeStatus)) {
      mappedStatus = "pending";
    } else {
      mappedStatus = "failed";
    }

    // If payment succeeded and not already processed, credit the user
    if (mappedStatus === "paid" && paymentData.status !== "paid") {
      const db = admin.firestore();
      await db.runTransaction(async (tx) => {
        const userRef = db.collection("users").doc(uid);
        const userSnap = await tx.get(userRef);
        
        if (!userSnap.exists) {
          throw new Error("User not found");
        }

        const currentCredits = Number(userSnap.data()?.credits || 0);
        const creditsToAdd = Number(paymentData.creditsToAdd || 0);
        const newCredits = currentCredits + creditsToAdd;

        tx.update(userRef, {
          credits: newCredits,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        tx.update(paymentDoc.ref, {
          status: "paid",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Create credit transaction record
        const txRef = db.collection("users").doc(uid).collection("creditTransactions").doc();
        tx.set(txRef, {
          userId: uid,
          type: "purchase_stripe",
          provider: "stripe",
          paymentReference: paymentData.paymentReference,
          ronAmount: paymentData.ronAmount,
          amount: creditsToAdd,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
    } else {
      // Just update the status
      await paymentDoc.ref.update({
        status: mappedStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return {
      paymentIntentId,
      status: mappedStatus,
      creditsAdded: mappedStatus === "paid" ? paymentData.creditsToAdd : 0,
      ronAmount: paymentData.ronAmount,
    };
  } catch (error: any) {
    logger.error("confirmStripePaymentCallable failed", {error: error?.message || error});
    throw new HttpsError("internal", error?.message || "Failed to confirm payment");
  }
});

/**
 * Get Stripe payment status
 */
export const getStripePaymentStatusCallable = onCall({region: "europe-west1"}, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Missing auth");
  }

  const uid = request.auth.uid;
  const paymentIntentId = String((request.data as any)?.paymentIntentId || "").trim();
  if (!paymentIntentId) {
    throw new HttpsError("invalid-argument", "paymentIntentId is required");
  }

  // Find the payment record
  const paymentsQuery = await admin.firestore()
    .collection("creditPayments")
    .where("stripePaymentIntentId", "==", paymentIntentId)
    .where("userId", "==", uid)
    .limit(1)
    .get();

  if (paymentsQuery.empty) {
    throw new HttpsError("not-found", "Payment record not found");
  }

  const paymentDoc = paymentsQuery.docs[0];
  const paymentData = paymentDoc.data();

  return {
    paymentIntentId,
    status: paymentData.status,
    creditsAdded: paymentData.status === "paid" ? paymentData.creditsToAdd : 0,
    ronAmount: paymentData.ronAmount,
    paymentReference: paymentData.paymentReference,
  };
});

// IAP Product ID to credits mapping
const IAP_PRODUCT_CREDITS: Record<string, number> = {
  "ro.enumismatica.credits.20": 20,
  "ro.enumismatica.credits.50": 50,
  "ro.enumismatica.credits.100": 100,
  "ro.enumismatica.credits.200": 200,
};

/**
 * Validate In-App Purchase and credit the user
 * Supports both Apple App Store and Google Play Store
 */
export const validateIAPPurchaseCallable = onCall({region: "europe-west1"}, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Missing auth");
  }

  const uid = request.auth.uid;
  const data = request.data as {
    productId?: string;
    purchaseToken?: string;
    transactionId?: string;
    platform?: string;
  };

  const productId = data.productId || "";
  const purchaseToken = data.purchaseToken || "";
  const transactionId = data.transactionId || "";
  const platform = data.platform || "";

  if (!productId) {
    throw new HttpsError("invalid-argument", "productId is required");
  }

  if (!purchaseToken) {
    throw new HttpsError("invalid-argument", "purchaseToken is required");
  }

  // Get credits for this product
  const creditsToAdd = IAP_PRODUCT_CREDITS[productId] || 0;
  if (creditsToAdd === 0) {
    throw new HttpsError("invalid-argument", "Unknown product ID");
  }

  // Create a unique payment reference
  const paymentReference = `iap_${platform}_${transactionId || purchaseToken.substring(0, 20)}`;

  // Check if this purchase has already been processed (idempotency)
  const existingPaymentQuery = await admin.firestore()
    .collection("creditPayments")
    .where("paymentReference", "==", paymentReference)
    .where("userId", "==", uid)
    .limit(1)
    .get();

  if (!existingPaymentQuery.empty) {
    const existingPayment = existingPaymentQuery.docs[0].data();
    logger.info("IAP purchase already processed", {
      userId: uid,
      paymentReference,
      status: existingPayment.status,
    });
    
    return {
      success: existingPayment.status === "paid",
      creditsAdded: existingPayment.status === "paid" ? existingPayment.creditsToAdd : 0,
      alreadyProcessed: true,
    };
  }

  try {
    // For development/testing, we'll trust the purchase token
    // In production, you should validate with Apple/Google servers
    // 
    // Apple App Store Server API:
    // https://developer.apple.com/documentation/appstoreserverapi
    // 
    // Google Play Developer API:
    // https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products/get
    
    // TODO: Implement server-side receipt validation for production
    // For now, we trust the client (development mode)
    const isValid = true; // In production, validate with Apple/Google

    if (!isValid) {
      throw new Error("Purchase validation failed");
    }

    // Create payment record
    const paymentRef = admin.firestore().collection("creditPayments").doc();
    
    await paymentRef.set({
      userId: uid,
      status: "pending",
      provider: "iap",
      platform: platform,
      productId: productId,
      purchaseToken: purchaseToken,
      transactionId: transactionId,
      paymentReference: paymentReference,
      creditsToAdd: creditsToAdd,
      ronAmount: creditsToAdd, // 1 RON = 1 credit
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Credit the user in a transaction
    const db = admin.firestore();
    await db.runTransaction(async (tx) => {
      const userRef = db.collection("users").doc(uid);
      const userSnap = await tx.get(userRef);
      
      if (!userSnap.exists) {
        throw new Error("User not found");
      }

      const currentCredits = Number(userSnap.data()?.credits || 0);
      const newCredits = currentCredits + creditsToAdd;

      tx.update(userRef, {
        credits: newCredits,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.update(paymentRef, {
        status: "paid",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create credit transaction record
      const txRecordRef = db.collection("users").doc(uid).collection("creditTransactions").doc();
      tx.set(txRecordRef, {
        userId: uid,
        type: "purchase_iap",
        provider: "iap",
        platform: platform,
        productId: productId,
        paymentReference: paymentReference,
        ronAmount: creditsToAdd,
        amount: creditsToAdd,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    logger.info("IAP purchase validated and credited", {
      userId: uid,
      productId,
      creditsToAdd,
      paymentReference,
    });

    return {
      success: true,
      creditsAdded: creditsToAdd,
    };
  } catch (error: any) {
    logger.error("IAP validation failed", {
      error: error?.message || error,
      userId: uid,
      productId,
      purchaseToken: purchaseToken.substring(0, 20) + "...",
    });
    
    return {
      success: false,
      creditsAdded: 0,
      error: error?.message || "Purchase validation failed",
    };
  }
});

const ESEMANEAZA_API_BASE = process.env.ESEMANEAZA_API_BASE || "https://app.esemneaza.ro/api/v1";
const ESEMANEAZA_API_KEY = process.env.ESEMANEAZA_API_KEY || "";
const ESEMANEAZA_WEBHOOK_SECRET = process.env.ESEMANEAZA_WEBHOOK_SECRET || "";
const CONTRACT_SIGN_REDIRECT_BASE = process.env.CONTRACT_SIGN_REDIRECT_BASE || "https://enumismatica.ro";
const ESEMANEAZA_TEMPLATE_ID = process.env.ESEMANEAZA_TEMPLATE_ID || "";

type ESignStatus = "not_started" | "in_progress" | "completed" | "canceled" | "rejected" | "failed";

interface EsemneazaRecipientResponse {
  id?: string;
  name?: string;
  email?: string;
  sigStatus?: string;
  signUrl?: string;
}

interface EsemneazaRequestResponse {
  id: string;
  status: string;
  fileName?: string;
  recipients?: EsemneazaRecipientResponse[];
}

interface EsemneazaUploadResponse {
  fileName: string;
}

function getHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  return value || "";
}

function assertEsemneazaConfigured(): void {
  if (!ESEMANEAZA_API_KEY) {
    throw new HttpsError("failed-precondition", "ESEMANEAZA_API_KEY is not configured.");
  }
}

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildSimplePdfDocument(title: string, body: string): Buffer {
  const normalizedBody = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = [title, "", ...normalizedBody.split("\n")].slice(0, 120);

  const textCommands = [
    "BT",
    "/F1 10 Tf",
    "40 800 Td",
    ...lines.map((line) => `(${escapePdfText(line)}) Tj T*`),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(textCommands, "utf8")} >>\nstream\n${textCommands}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  objects.forEach((obj, idx) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${idx + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  offsets.slice(1).forEach((offset) => {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });

  pdf += "trailer\n";
  pdf += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += "startxref\n";
  pdf += `${xrefOffset}\n`;
  pdf += "%%EOF\n";

  return Buffer.from(pdf, "utf8");
}

async function uploadContractPdfToEsemneaza(input: {
  pdfBuffer: Buffer;
  fileName: string;
}): Promise<EsemneazaUploadResponse> {
  assertEsemneazaConfigured();

  const formDataCtor = (globalThis as any).FormData;
  const blobCtor = (globalThis as any).Blob;

  if (!formDataCtor || !blobCtor) {
    throw new HttpsError("failed-precondition", "FormData/Blob are not available in this runtime.");
  }

  const form = new formDataCtor();
  const blob = new blobCtor([input.pdfBuffer], {type: "application/pdf"});
  form.append("file", blob, input.fileName);

  const response = await fetch(`${ESEMANEAZA_API_BASE}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ESEMANEAZA_API_KEY}`,
    },
    body: form as any,
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new HttpsError(
      "internal",
      `eSemneaza upload failed (${response.status}): ${bodyText || "unknown error"}`,
    );
  }

  return await response.json() as EsemneazaUploadResponse;
}

function normalizeRecipientRole(
  recipient: EsemneazaRecipientResponse,
  buyerEmail: string,
  sellerEmail: string,
  index: number,
): "buyer" | "seller" {
  const recEmail = String(recipient.email || "").trim().toLowerCase();
  if (recEmail && recEmail === buyerEmail.trim().toLowerCase()) return "buyer";
  if (recEmail && recEmail === sellerEmail.trim().toLowerCase()) return "seller";
  return index === 0 ? "seller" : "buyer";
}

async function createEsemneazaSignRequest(input: {
  fileName?: string;
  contractId: string;
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  sellerEmail: string;
  templateId?: string;
}): Promise<EsemneazaRequestResponse> {
  assertEsemneazaConfigured();

  const sellerRedirect = `${CONTRACT_SIGN_REDIRECT_BASE}/contracts/${encodeURIComponent(input.contractId)}?role=seller`;
  const buyerRedirect = `${CONTRACT_SIGN_REDIRECT_BASE}/contracts/${encodeURIComponent(input.contractId)}?role=buyer`;

  const useTemplate = Boolean(input.templateId);
  const recipientsBase = [
    {
      type: "EMAIL",
      email: input.sellerEmail,
      name: input.sellerName,
      options: ["one_click_sign"],
      signedRedirectUrl: sellerRedirect,
    },
    {
      type: "EMAIL",
      email: input.buyerEmail,
      name: input.buyerName,
      options: ["one_click_sign"],
      signedRedirectUrl: buyerRedirect,
    },
  ];

  const recipients = useTemplate ? recipientsBase : [
    {
      ...recipientsBase[0],
      fields: [
        {
          type: "SIGNATURE",
          pageNum: 1,
          x: 80,
          y: 680,
          width: 200,
          height: 60,
          required: true,
        },
      ],
    },
    {
      ...recipientsBase[1],
      fields: [
        {
          type: "SIGNATURE",
          pageNum: 1,
          x: 350,
          y: 680,
          width: 200,
          height: 60,
          required: true,
        },
      ],
    },
  ];

  const payload: Record<string, any> = {
    signInOrder: true,
    senderName: "eNumismatica",
    emailSubject: "Contract de vânzare-cumpărare — semnătură necesară",
    emailMessage: "Vă rugăm să semnați contractul folosind linkul securizat de mai jos.",
    tags: ["enumismatica", "contract"],
    extractTags: true,
    recipients,
  };

  if (input.templateId) {
    payload.templateId = input.templateId;
  } else if (input.fileName) {
    payload.fileName = input.fileName;
  } else {
    throw new HttpsError("failed-precondition", "Missing eSemneaza document source (templateId or fileName).");
  }

  const response = await fetch(`${ESEMANEAZA_API_BASE}/requests`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ESEMANEAZA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new HttpsError(
      "internal",
      `eSemneaza request creation failed (${response.status}): ${bodyText || "unknown error"}`,
    );
  }

  return await response.json() as EsemneazaRequestResponse;
}

async function fetchEsemneazaRequestStatus(requestId: string): Promise<EsemneazaRequestResponse> {
  assertEsemneazaConfigured();

  const response = await fetch(`${ESEMANEAZA_API_BASE}/requests/${encodeURIComponent(requestId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${ESEMANEAZA_API_KEY}`,
    },
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new HttpsError(
      "internal",
      `eSemneaza status fetch failed (${response.status}): ${bodyText || "unknown error"}`,
    );
  }

  return await response.json() as EsemneazaRequestResponse;
}

async function fetchCompletedDownloadUrl(requestId: string): Promise<string | null> {
  assertEsemneazaConfigured();

  const response = await fetch(
    `${ESEMANEAZA_API_BASE}/requests/${encodeURIComponent(requestId)}/completed_download_url`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ESEMANEAZA_API_KEY}`,
      },
    },
  );

  if (response.status === 403) {
    return null;
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    logger.warn("Failed to fetch eSemneaza completed doc URL", {
      requestId,
      status: response.status,
      body: bodyText,
    });
    return null;
  }

  const body = await response.json() as {docUrl?: string};
  return body.docUrl || null;
}

async function cancelEsemneazaRequest(requestId: string): Promise<boolean> {
  assertEsemneazaConfigured();

  const response = await fetch(
    `${ESEMANEAZA_API_BASE}/requests/${encodeURIComponent(requestId)}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ESEMANEAZA_API_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    logger.warn("Failed to cancel eSemneaza request", {
      requestId,
      status: response.status,
      body: bodyText,
    });
    return false;
  }

  return true;
}

async function persistSignedContractPdf(input: {
  contractId: string;
  requestId: string;
  docUrl: string;
}): Promise<{storagePath: string; signedUrl: string | null}> {
  const response = await fetch(input.docUrl, {method: "GET"});
  if (!response.ok) {
    throw new HttpsError("internal", `Failed to download signed contract PDF (${response.status}).`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const bucket = admin.storage().bucket();
  const storagePath = `contracts/signed/${input.contractId}/${input.requestId}.pdf`;
  const file = bucket.file(storagePath);

  await file.save(bytes, {
    contentType: "application/pdf",
    resumable: false,
    metadata: {
      cacheControl: "private, max-age=0",
    },
  });

  let signedUrl: string | null = null;
  try {
    const signed = await file.getSignedUrl({
      action: "read",
      expires: "2500-01-01",
    });
    signedUrl = signed[0] || null;
  } catch (error) {
    logger.warn("Failed to generate signed URL for persisted contract PDF", {
      contractId: input.contractId,
      requestId: input.requestId,
      error,
    });
  }

  return {storagePath, signedUrl};
}

function mapEsemneazaStatus(statusRaw: string): {eSignStatus: ESignStatus; contractStatus: string; immutable: boolean} {
  const status = String(statusRaw || "").trim().toUpperCase();
  switch (status) {
    case "COMPLETED":
      return {eSignStatus: "completed", contractStatus: "immutable", immutable: true};
    case "CANCELED":
      return {eSignStatus: "canceled", contractStatus: "cancelled", immutable: false};
    case "REJECTED":
      return {eSignStatus: "rejected", contractStatus: "cancelled", immutable: false};
    case "IN_PROGRESS":
      return {eSignStatus: "in_progress", contractStatus: "pending", immutable: false};
    default:
      return {eSignStatus: "failed", contractStatus: "pending", immutable: false};
  }
}

async function syncContractESignState(input: {
  contractRef: FirebaseFirestore.DocumentReference;
  contractId: string;
  contractData: Record<string, any>;
}): Promise<{eSignStatus: ESignStatus; requestStatus: string}> {
  const requestId = String(input.contractData.eSignRequestId || "").trim();
  if (!requestId) {
    throw new HttpsError("failed-precondition", "Contract does not have eSign request ID.");
  }

  const requestStatus = await fetchEsemneazaRequestStatus(requestId);
  const mapped = mapEsemneazaStatus(requestStatus.status || "");

  const recipientsRaw = Array.isArray(requestStatus.recipients) ? requestStatus.recipients : [];
  const buyerEmail = String(input.contractData.buyerEmail || "");
  const sellerEmail = String(input.contractData.sellerEmail || "");
  const recipients = recipientsRaw.map((recipient, index) => ({
    id: recipient.id,
    name: recipient.name,
    email: recipient.email,
    sigStatus: recipient.sigStatus,
    signUrl: recipient.signUrl,
    role: normalizeRecipientRole(recipient, buyerEmail, sellerEmail, index),
  }));

  const patch: Record<string, unknown> = {
    eSignStatus: mapped.eSignStatus,
    status: mapped.contractStatus,
    immutableAfterBothAccepted: mapped.immutable,
    eSignRecipients: recipients,
    eSignLastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    eSignError: admin.firestore.FieldValue.delete(),
  };

  if (mapped.eSignStatus === "completed") {
    patch.eSignCompletedAt = admin.firestore.FieldValue.serverTimestamp();
    patch.buyerAcceptedAt = input.contractData.buyerAcceptedAt || admin.firestore.FieldValue.serverTimestamp();
    patch.sellerAcceptedAt = input.contractData.sellerAcceptedAt || admin.firestore.FieldValue.serverTimestamp();

    const completedUrl = await fetchCompletedDownloadUrl(requestId);
    if (completedUrl) {
      patch.eSignCompletedDocUrl = completedUrl;

      try {
        const persisted = await persistSignedContractPdf({
          contractId: input.contractId,
          requestId,
          docUrl: completedUrl,
        });
        patch.eSignSignedStoragePath = persisted.storagePath;
        if (persisted.signedUrl) {
          patch.eSignCompletedDocUrl = persisted.signedUrl;
        }
      } catch (error) {
        logger.warn("Failed to persist signed contract PDF in Storage", {
          contractId: input.contractId,
          requestId,
          error,
        });
      }
    }
  }

  await input.contractRef.set(patch, {merge: true});

  return {
    eSignStatus: mapped.eSignStatus,
    requestStatus: requestStatus.status || "UNKNOWN",
  };
}

async function getUserBasics(userId: string): Promise<{name: string; email: string | null; role?: string}> {
  const userDoc = await admin.firestore().collection("users").doc(userId).get();
  if (!userDoc.exists) {
    return {
      name: `Utilizator ${userId.slice(0, 6)}`,
      email: null,
    };
  }

  const data = userDoc.data() as Record<string, unknown>;
  const nameCandidate =
    (typeof data.displayName === "string" && data.displayName.trim()) ||
    (typeof data.name === "string" && data.name.trim()) ||
    `Utilizator ${userId.slice(0, 6)}`;

  return {
    name: nameCandidate,
    email: typeof data.email === "string" ? data.email : null,
    role: typeof data.role === "string" ? data.role : undefined,
  };
}

function canManageContract(userId: string, contractData: Record<string, any>, role?: string): boolean {
  const participantIds = Array.isArray(contractData.participantIds) ? contractData.participantIds : [
    contractData.buyerId,
    contractData.sellerId,
  ];

  if (participantIds.includes(userId)) {
    return true;
  }

  return ["admin", "moderator", "superadmin"].includes(String(role || ""));
}

export const startContractESignCallable = onCall({
  region: "europe-west1",
  secrets: ["ESEMANEAZA_API_KEY"],
}, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Missing auth");
  }

  assertEsemneazaConfigured();

  const userId = request.auth.uid;
  const contractId = String((request.data as any)?.contractId || "").trim();
  if (!contractId) {
    throw new HttpsError("invalid-argument", "contractId is required");
  }

  const db = admin.firestore();
  const contractRef = db.collection("contracts").doc(contractId);
  const contractSnap = await contractRef.get();
  if (!contractSnap.exists) {
    throw new HttpsError("not-found", "Contract not found");
  }

  const contractData = contractSnap.data() as Record<string, any>;
  const actor = await getUserBasics(userId);
  if (!canManageContract(userId, contractData, actor.role)) {
    throw new HttpsError("permission-denied", "Not allowed to start e-sign for this contract");
  }

  if (contractData.eSignStatus === "in_progress" || contractData.eSignStatus === "completed") {
    return {
      contractId,
      requestId: contractData.eSignRequestId || null,
      status: contractData.eSignStatus,
      recipients: Array.isArray(contractData.eSignRecipients) ? contractData.eSignRecipients : [],
    };
  }

  const buyerId = String(contractData.buyerId || "").trim();
  const sellerId = String(contractData.sellerId || "").trim();
  if (!buyerId || !sellerId) {
    throw new HttpsError("failed-precondition", "Contract is missing buyer/seller IDs");
  }

  const [buyer, seller] = await Promise.all([getUserBasics(buyerId), getUserBasics(sellerId)]);

  if (!buyer.email || !seller.email) {
    throw new HttpsError("failed-precondition", "Buyer or seller email is missing for e-sign");
  }

  const requestedTemplateId = String((request.data as any)?.templateId || "").trim();
  const resolvedTemplateId = String(requestedTemplateId || contractData.eSignTemplateId || ESEMANEAZA_TEMPLATE_ID || "").trim();

  let uploadedFileName: string | null = null;
  let requestFileName: string | undefined;

  if (!resolvedTemplateId) {
    const title = String(contractData.title || `Contract ${contractId}`);
    const body = String(contractData.body || "");
    if (!body.trim()) {
      throw new HttpsError("failed-precondition", "Contract body is empty");
    }

    const pdfBuffer = buildSimplePdfDocument(title, body);
    const fileName = `contract-${contractId}-${Date.now()}.pdf`;

    const uploaded = await uploadContractPdfToEsemneaza({
      pdfBuffer,
      fileName,
    });
    uploadedFileName = uploaded.fileName;
    requestFileName = uploaded.fileName;
  }

  const requestResult = await createEsemneazaSignRequest({
    fileName: requestFileName,
    templateId: resolvedTemplateId || undefined,
    contractId,
    buyerName: buyer.name,
    buyerEmail: buyer.email,
    sellerName: seller.name,
    sellerEmail: seller.email,
  });

  const recipientsRaw = Array.isArray(requestResult.recipients) ? requestResult.recipients : [];
  const recipients = recipientsRaw.map((recipient, index) => ({
    id: recipient.id,
    name: recipient.name,
    email: recipient.email,
    sigStatus: recipient.sigStatus,
    signUrl: recipient.signUrl,
    role: normalizeRecipientRole(recipient, buyer.email || "", seller.email || "", index),
  }));

  await contractRef.set({
    eSignProvider: "esemneaza",
    eSignStatus: "in_progress",
    eSignRequestId: requestResult.id,
    eSignTemplateId: resolvedTemplateId || admin.firestore.FieldValue.delete(),
    eSignFileName: uploadedFileName || requestResult.fileName || admin.firestore.FieldValue.delete(),
    eSignRecipients: recipients,
    eSignStartedAt: admin.firestore.FieldValue.serverTimestamp(),
    eSignLastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    buyerEmail: buyer.email,
    sellerEmail: seller.email,
    status: "pending",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    eSignError: admin.firestore.FieldValue.delete(),
  }, {merge: true});

  return {
    contractId,
    requestId: requestResult.id,
    status: requestResult.status,
    recipients,
  };
});

export const syncContractESignStatusCallable = onCall({
  region: "europe-west1",
  secrets: ["ESEMANEAZA_API_KEY"],
}, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Missing auth");
  }

  assertEsemneazaConfigured();

  const userId = request.auth.uid;
  const contractId = String((request.data as any)?.contractId || "").trim();
  if (!contractId) {
    throw new HttpsError("invalid-argument", "contractId is required");
  }

  const db = admin.firestore();
  const contractRef = db.collection("contracts").doc(contractId);
  const contractSnap = await contractRef.get();
  if (!contractSnap.exists) {
    throw new HttpsError("not-found", "Contract not found");
  }

  const contractData = contractSnap.data() as Record<string, any>;
  const actor = await getUserBasics(userId);
  if (!canManageContract(userId, contractData, actor.role)) {
    throw new HttpsError("permission-denied", "Not allowed to sync this contract");
  }

  const syncResult = await syncContractESignState({
    contractRef,
    contractId,
    contractData,
  });

  return {
    contractId,
    eSignStatus: syncResult.eSignStatus,
    requestStatus: syncResult.requestStatus,
  };
});

export const cancelContractESignCallable = onCall({
  region: "europe-west1",
  secrets: ["ESEMANEAZA_API_KEY"],
}, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Missing auth");
  }

  assertEsemneazaConfigured();

  const userId = request.auth.uid;
  const contractId = String((request.data as any)?.contractId || "").trim();
  if (!contractId) {
    throw new HttpsError("invalid-argument", "contractId is required");
  }

  const db = admin.firestore();
  const contractRef = db.collection("contracts").doc(contractId);
  const contractSnap = await contractRef.get();
  if (!contractSnap.exists) {
    throw new HttpsError("not-found", "Contract not found");
  }

  const contractData = contractSnap.data() as Record<string, any>;
  const actor = await getUserBasics(userId);
  if (!canManageContract(userId, contractData, actor.role)) {
    throw new HttpsError("permission-denied", "Not allowed to cancel this contract e-sign flow");
  }

  const requestId = String(contractData.eSignRequestId || "").trim();
  if (!requestId) {
    return {contractId, canceled: false};
  }

  const canceled = await cancelEsemneazaRequest(requestId);

  await contractRef.set({
    eSignStatus: "canceled",
    status: "cancelled",
    immutableAfterBothAccepted: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    eSignLastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  return {contractId, canceled};
});

export const esemneazaWebhook = onRequest({
  region: "europe-west1",
  secrets: ["ESEMANEAZA_API_KEY"],
}, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({error: "Method not allowed"});
    return;
  }

  if (ESEMANEAZA_WEBHOOK_SECRET) {
    const headerSecret = getHeaderValue(req.headers["x-esemneaza-webhook-secret"]);
    const authHeader = getHeaderValue(req.headers.authorization);
    const authSecret = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (headerSecret !== ESEMANEAZA_WEBHOOK_SECRET && authSecret !== ESEMANEAZA_WEBHOOK_SECRET) {
      res.status(403).json({error: "Forbidden"});
      return;
    }
  }

  const eventBody = (req.body && typeof req.body === "object") ? req.body as Record<string, any> : {};
  const requestId =
    String(eventBody.requestId || eventBody.request_id || eventBody.data?.requestId || "").trim();

  if (!requestId) {
    res.status(202).json({ok: true, ignored: true});
    return;
  }

  try {
    const db = admin.firestore();
    const contractQuery = await db
      .collection("contracts")
      .where("eSignRequestId", "==", requestId)
      .limit(1)
      .get();

    if (contractQuery.empty) {
      logger.info("eSemneaza webhook requestId not linked to any contract", {requestId});
      res.status(200).json({ok: true, matched: false});
      return;
    }

    const contractDoc = contractQuery.docs[0];
    const contractData = contractDoc.data() as Record<string, any>;

    await syncContractESignState({
      contractRef: contractDoc.ref,
      contractId: contractDoc.id,
      contractData,
    });

    res.status(200).json({ok: true, matched: true, contractId: contractDoc.id});
  } catch (error) {
    logger.error("Failed to process eSemneaza webhook", {requestId, error});
    res.status(500).json({ok: false});
  }
});

export const syncPendingContractESignRequests = onSchedule(
  {
    region: "europe-west1",
    schedule: "every 30 minutes",
    timeZone: "Europe/Bucharest",
    secrets: ["ESEMANEAZA_API_KEY"],
  },
  async () => {
    if (!ESEMANEAZA_API_KEY) {
      logger.info("Skipping e-sign sync schedule: ESEMANEAZA_API_KEY is not configured");
      return;
    }

    const db = admin.firestore();
    const pendingSnap = await db
      .collection("contracts")
      .where("eSignStatus", "==", "in_progress")
      .limit(100)
      .get();

    if (pendingSnap.empty) {
      logger.info("No pending e-sign contracts to sync");
      return;
    }

    let synced = 0;
    let failed = 0;

    for (const contractDoc of pendingSnap.docs) {
      try {
        await syncContractESignState({
          contractRef: contractDoc.ref,
          contractId: contractDoc.id,
          contractData: contractDoc.data() as Record<string, any>,
        });
        synced += 1;
      } catch (error) {
        failed += 1;
        logger.error("Failed to sync pending e-sign contract", {
          contractId: contractDoc.id,
          error,
        });
      }
    }

    logger.info("syncPendingContractESignRequests summary", {
      total: pendingSnap.size,
      synced,
      failed,
    });
  },
);

interface NotificationDoc {
  type?: string;
  pushed?: boolean;
  title?: string;
  senderName?: string;
  message?: string;
  conversationId?: string;
  supportChatId?: string;
  auctionId?: string;
  productId?: string;
  orderId?: string;
  offerId?: string;
  itemType?: string;
  itemId?: string;
  deepLink?: string;
  url?: string;
}

interface DeviceRecord {
  expoPushToken?: string;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  channelId?: string; // Android notification channel ID
  sound?: string; // Sound to play
  priority?: 'default' | 'normal' | 'high'; // Notification priority
  data: {
    conversationId: string | null;
    supportChatId?: string | null;
    auctionId: string | null;
    productId?: string | null;
    orderId?: string | null;
    notificationId: string | null;
    type: string | undefined;
    offerId?: string | null;
    itemType?: string | null;
    itemId?: string | null;
    deepLink?: string | null;
    url?: string | null;
  };
}

/**
 * Split an array into fixed-size chunks.
 */
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Retry a function with exponential backoff for transient errors.
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if this is a transient error that should be retried
      const isTransient = 
        error?.code === 'PERMISSION_DENIED' ||
        error?.code === 'UNAVAILABLE' ||
        error?.code === 'DEADLINE_EXCEEDED' ||
        error?.code === 'INTERNAL' ||
        error?.code === 'RESOURCE_EXHAUSTED';
      
      if (!isTransient || attempt === maxRetries - 1) {
        // Not a transient error or we've exhausted retries
        throw error;
      }
      
      // Calculate exponential backoff delay
      const delay = baseDelayMs * Math.pow(2, attempt);
      logger.info(`Retrying operation (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms`, {
        errorCode: error?.code,
        errorMessage: error?.message,
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: {
    error?: string;
    expoPushToken?: string;
    fault?: "developer" | "device";
  };
}

interface ExpoPushResponse {
  data: ExpoPushTicket[];
}

interface ExpoPushSendResult {
  ticketIds: string[];
  attemptedCount: number;
  successCount: number;
  errorCount: number;
  hadRequestError: boolean;
}

interface ExpoPushReceipt {
  status: "ok" | "error";
  message?: string;
  details?: {
    error?: string;
    expoPushToken?: string;
    fault?: "developer" | "device";
  };
}

interface ExpoPushReceiptsResponse {
  data: Record<string, ExpoPushReceipt>;
}

interface ExpoPushReceiptCheckResult {
  state: "checked" | "not_ready" | "request_failed";
  checkedCount: number;
  okCount: number;
  errorCount: number;
}

const DEFAULT_SITE_URL = process.env.SITE_URL || "https://enumismatica.ro";
const EMAIL_API_URL = process.env.EMAIL_API_URL || `${DEFAULT_SITE_URL}/api/email/send`;
const APP_SCHEME_PREFIX = "enumismatica://";

function encodeSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

function buildAppAuctionLink(auctionId: string): string {
  return `${APP_SCHEME_PREFIX}auction/${encodeSegment(auctionId)}`;
}

function buildAppMessagesLink(conversationId?: string): string {
  if (conversationId && conversationId.trim().length > 0) {
    return `${APP_SCHEME_PREFIX}messages/${encodeSegment(conversationId)}`;
  }
  return `${APP_SCHEME_PREFIX}messages`;
}

type NotificationType = "auction_won" | "auction_ended_no_win";

async function sendTemplateEmailFromFunctions(input: {
  to: string;
  templateKey: string;
  vars: Record<string, unknown>;
}): Promise<void> {
  if (!input.to || !input.templateKey) return;

  const response = await fetch(EMAIL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: input.to,
      templateKey: input.templateKey,
      vars: input.vars,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logger.error("Failed to send template email from Cloud Function", {
      to: input.to,
      templateKey: input.templateKey,
      status: response.status,
      body,
    });
  }
}

async function createDeterministicUserNotification(input: {
  userId: string;
  notificationId: string;
  type: NotificationType;
  message: string;
  auctionId: string;
  auctionTitle: string;
  bidAmount?: number;
}): Promise<void> {
  const notificationRef = admin
    .firestore()
    .collection("users")
    .doc(input.userId)
    .collection("notifications")
    .doc(input.notificationId);

  const existing = await notificationRef.get();
  if (existing.exists) {
    return;
  }

  const payload: Record<string, unknown> = {
    userId: input.userId,
    type: input.type,
    message: input.message,
    read: false,
    pushed: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    auctionId: input.auctionId,
    auctionTitle: input.auctionTitle,
  };

  if (typeof input.bidAmount === "number") {
    payload.bidAmount = input.bidAmount;
  }

  await notificationRef.set(payload);
}

async function getAuctionDisplayTitle(auctionId: string, productId: string | null): Promise<string> {
  if (!productId) return `Licitație ${auctionId}`;

  try {
    const productSnap = await admin.firestore().collection("products").doc(productId).get();
    if (productSnap.exists) {
      const productData = productSnap.data() as Record<string, unknown> | undefined;
      const productName = typeof productData?.name === "string" ? productData.name : null;
      if (productName && productName.trim().length > 0) {
        return productName;
      }
    }
  } catch (error) {
    logger.error("Failed to resolve auction title from product", {auctionId, productId, error});
  }

  return `Licitație ${auctionId}`;
}

async function dispatchAuctionResultNotifications(auctionId: string): Promise<void> {
  const db = admin.firestore();
  const auctionRef = db.collection("auctions").doc(auctionId);
  const auctionSnap = await auctionRef.get();

  if (!auctionSnap.exists) return;

  const auctionData = (auctionSnap.data() || {}) as Record<string, unknown>;
  const status = typeof auctionData.status === "string" ? auctionData.status : "";
  if (status !== "ended") return;

  const notificationStatus = typeof auctionData.resultNotificationStatus === "string"
    ? auctionData.resultNotificationStatus
    : null;
  if (notificationStatus === "done") return;

  const winnerId = typeof auctionData.winnerId === "string" && auctionData.winnerId.trim().length > 0
    ? auctionData.winnerId
    : null;
  const ownerId = typeof auctionData.ownerId === "string" && auctionData.ownerId.trim().length > 0
    ? auctionData.ownerId
    : null;
  const productId = typeof auctionData.productId === "string" && auctionData.productId.trim().length > 0
    ? auctionData.productId
    : null;
  const currentBid = Number(auctionData.currentBid || 0);

  const auctionTitle = await getAuctionDisplayTitle(auctionId, productId);

  if (winnerId) {
    const winnerMessage = `Felicitări! Ai câștigat licitația ${auctionTitle} cu oferta de ${currentBid.toFixed(2)} RON`;

    await createDeterministicUserNotification({
      userId: winnerId,
      notificationId: `auction_won_${auctionId}`,
      type: "auction_won",
      message: winnerMessage,
      auctionId,
      auctionTitle,
      bidAmount: currentBid,
    });

    try {
      const winnerDoc = await db.collection("users").doc(winnerId).get();
      const winnerData = winnerDoc.exists ? winnerDoc.data() : undefined;
      const winnerEmail = typeof winnerData?.email === "string" ? winnerData.email : null;
      const winnerName =
        (typeof winnerData?.displayName === "string" && winnerData.displayName) ||
        (typeof winnerData?.name === "string" && winnerData.name) ||
        "Cumpărător";

      if (winnerEmail) {
        const appAuctionLink = buildAppAuctionLink(auctionId);
        const appMessagesLink = buildAppMessagesLink();
        await sendTemplateEmailFromFunctions({
          to: winnerEmail,
          templateKey: "auction_won_buyer",
          vars: {
            listing_title: auctionTitle,
            final_price: `${currentBid.toFixed(2)} RON`,
            listing_link: appAuctionLink,
            messages_link: appMessagesLink,
            web_listing_link: `${DEFAULT_SITE_URL}/auctions/${auctionId}`,
            web_messages_link: `${DEFAULT_SITE_URL}/messages`,
          },
        });
      }

      if (ownerId) {
        const ownerDoc = await db.collection("users").doc(ownerId).get();
        const ownerData = ownerDoc.exists ? ownerDoc.data() : undefined;
        const ownerEmail = typeof ownerData?.email === "string" ? ownerData.email : null;

        if (ownerEmail) {
          const appAuctionLink = buildAppAuctionLink(auctionId);
          const appMessagesLink = buildAppMessagesLink();
          await sendTemplateEmailFromFunctions({
            to: ownerEmail,
            templateKey: "auction_sold_seller",
            vars: {
              listing_title: auctionTitle,
              final_price: `${currentBid.toFixed(2)} RON`,
              winner_name: winnerName,
              listing_link: appAuctionLink,
              messages_link: appMessagesLink,
              web_listing_link: `${DEFAULT_SITE_URL}/auctions/${auctionId}`,
              web_messages_link: `${DEFAULT_SITE_URL}/messages`,
            },
          });
        }
      }
    } catch (error) {
      logger.error("Failed to send winner/seller auction result emails", {auctionId, winnerId, ownerId, error});
    }
  } else {
    const bidsSnap = await db.collection("auctions").doc(auctionId).collection("bids").get();
    const bidderIds = [...new Set(
      bidsSnap.docs
        .map((bidDoc) => bidDoc.data()?.userId)
        .filter((uid) => typeof uid === "string" && uid.trim().length > 0),
    )] as string[];

    const endedMessage = `Licitația ${auctionTitle} s-a încheiat fără câștigător`;
    for (const bidderId of bidderIds) {
      await createDeterministicUserNotification({
        userId: bidderId,
        notificationId: `auction_ended_no_win_${auctionId}`,
        type: "auction_ended_no_win",
        message: endedMessage,
        auctionId,
        auctionTitle,
      });
    }
  }

  await auctionRef.update({
    resultNotificationStatus: "done",
    resultNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

/**
 * Check Expo push receipts for a list of ticket IDs.
 * Receipts are available ~15–30 seconds after the original push.
 * Returns whether all receipts were ok (true) or some had errors (false).
 */
async function checkExpoPushReceipts(
  ticketIds: string[],
  userId: string,
  notificationId: string
): Promise<ExpoPushReceiptCheckResult> {
  if (ticketIds.length === 0) {
    return {
      state: "not_ready",
      checkedCount: 0,
      okCount: 0,
      errorCount: 0,
    };
  }

  const receiptResponse = await fetch(EXPO_RECEIPTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({ ids: ticketIds }),
  });

  if (!receiptResponse.ok) {
    logger.warn("Failed to fetch Expo push receipts", {
      status: receiptResponse.status,
      userId,
      notificationId,
    });
    return {
      state: "request_failed",
      checkedCount: 0,
      okCount: 0,
      errorCount: 0,
    };
  }

  const body = await receiptResponse.json() as ExpoPushReceiptsResponse;
  const receipts = body?.data ?? {};

  let okCount = 0;
  let errorCount = 0;

  for (const [id, receipt] of Object.entries(receipts)) {
    if (receipt.status === "ok") {
      okCount++;
    } else {
      errorCount++;
      logger.error("Expo push receipt error — APNs/FCM REJECTED the notification", {
        ticketId: id,
        receiptStatus: receipt.status,
        receiptMessage: receipt.message,
        receiptErrorCode: receipt.details?.error,
        receiptFault: receipt.details?.fault,
        userId,
        notificationId,
      });

      if (receipt.details?.error === "DeviceNotRegistered") {
        logger.warn("DeviceNotRegistered receipt: APNs token is stale — should be removed from Firestore", {
          ticketId: id,
          userId,
          hint: "Query devices subcollection for this token and delete it",
        });
      }

      if (receipt.details?.error === "DeveloperError") {
        // TopicDisallowed is the most common DeveloperError — it means the APNs
        // Auth Key in Expo credentials is not authorised for the app's bundle ID.
        // This commonly indicates:
        //   1. Credentials are for the wrong Apple Team ID
        //   2. APNs environment mismatch (production app using development key)
        //   3. The App ID has NOT pushed notifications enabled in Apple Developer portal
        logger.error("DeveloperError receipt — APNs rejected with TopicDisallowed or similar", {
          ticketId: id,
          receiptMessage: receipt.message,
          userId,
          notificationId,
          fix: [
            "Run: eas credentials --platform ios",
            "Check APNs key team ID matches the app's provisioning profile",
            "Ensure Apple Dev portal App ID has Push Notifications enabled",
            "Remove old credentials and let EAS re-provision if needed",
          ],
        });
      }

      if (receipt.details?.error === "InvalidCredentials") {
        logger.error("InvalidCredentials receipt — APNs Auth Key is MISSING from Expo", {
          ticketId: id,
          userId,
          fix: "Go to expo.dev → Project → Credentials → iOS → Upload APNs P8 key",
        });
      }
    }
  }

  if (okCount + errorCount > 0) {
    logger.info("Expo push receipts summary", {
      userId,
      notificationId,
      total: okCount + errorCount,
      ok: okCount,
      errors: errorCount,
    });
  } else {
    logger.info("Expo push receipts not ready yet (normal if checked too early)", {
      userId,
      notificationId,
      checked: ticketIds.length,
    });

    return {
      state: "not_ready",
      checkedCount: 0,
      okCount: 0,
      errorCount: 0,
    };
  }

  return {
    state: "checked",
    checkedCount: okCount + errorCount,
    okCount,
    errorCount,
  };
}

/**
 * Send Expo push notifications in batches of 100.
 * Parses and logs individual ticket errors so delivery failures are visible.
 * Returns array of ticket IDs for optional receipt checking.
 */
async function sendExpoPushNotifications(
  messages: ExpoPushMessage[]
): Promise<ExpoPushSendResult> {
  if (messages.length === 0) {
    return {
      ticketIds: [],
      attemptedCount: 0,
      successCount: 0,
      errorCount: 0,
      hadRequestError: false,
    };
  }

  const chunks = chunkArray(messages, 100);
  const allTicketIds: string[] = [];
  let attemptedCount = 0;
  let successCount = 0;
  let errorCount = 0;
  let hadRequestError = false;

  await Promise.all(
    chunks.map(async (chunk) => {
      attemptedCount += chunk.length;

      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(chunk),
      });

      const bodyText = await response.text();
      if (!response.ok) {
        logger.error("Expo push HTTP request failed", {
          status: response.status,
          body: bodyText,
        });
        hadRequestError = true;
        errorCount += chunk.length;
        return;
      }

      // Parse the response to check individual ticket statuses
      let parsed: ExpoPushResponse | null = null;
      try {
        parsed = JSON.parse(bodyText) as ExpoPushResponse;
      } catch {
        logger.error("Failed to parse Expo push response", { body: bodyText });
        hadRequestError = true;
        errorCount += chunk.length;
        return;
      }

      const tickets = parsed?.data ?? [];
      let batchSuccessCount = 0;
      let batchErrorCount = 0;

      tickets.forEach((ticket, idx) => {
        if (ticket.status === "ok") {
          batchSuccessCount += 1;
          if (ticket.id) allTicketIds.push(ticket.id);
        } else {
          batchErrorCount += 1;
          const targetToken = chunk[idx]?.to ?? "unknown";
          logger.error("Expo push ticket error - notification NOT delivered", {
            ticketIndex: idx,
            ticketStatus: ticket.status,
            ticketMessage: ticket.message,
            ticketErrorCode: ticket.details?.error,
            ticketFault: ticket.details?.fault,
            targetToken: targetToken.substring(0, 25) + "...",
            // Common error codes:
            // DeviceNotRegistered - token is invalid/stale, delete it from Firestore
            // MessageTooBig - message payload too large
            // InvalidCredentials - APNs/FCM credentials not configured in Expo
            // MessageRateExceeded - too many messages sent to device
          });

          // If the token is no longer valid, we should flag it
          if (ticket.details?.error === "DeviceNotRegistered") {
            logger.warn("DeviceNotRegistered: token should be removed from Firestore", {
              targetToken: targetToken.substring(0, 25) + "...",
            });
          }

          if (ticket.details?.error === "InvalidCredentials") {
            logger.error("InvalidCredentials: APNs key or FCM credentials are NOT configured in Expo dashboard!", {
              hint: "Go to https://expo.dev > Project > Credentials and add APNs key for iOS",
            });
          }
        }
      });

      logger.info("Expo push sent", {
        httpStatus: response.status,
        batchSize: chunk.length,
        successTickets: batchSuccessCount,
        errorTickets: batchErrorCount,
      });

      successCount += batchSuccessCount;
      errorCount += batchErrorCount;
    })
  );

  return {
    ticketIds: allTicketIds,
    attemptedCount,
    successCount,
    errorCount,
    hadRequestError,
  };
}

/**
 * Send Expo push notifications for all notification types.
 * Handles: new_message, outbid, auction_won, auction_ended_no_win
 */
export const sendNotificationPush = onDocumentCreated(
  {
    region: "europe-west1",
    document: "users/{userId}/notifications/{notificationId}",
  },
  async (event) => {
    const params = event.params as {
      userId: string;
      notificationId: string;
    };
    const snap = event.data;
    const data = snap?.data() as NotificationDoc | undefined;

    if (!data) {
      logger.info("No notification data", {
        userId: params.userId,
        notificationId: params.notificationId,
      });
      return;
    }

    // Check if we've already processed this notification
    const notificationRef = admin.firestore().collection("users").doc(params.userId).collection("notifications").doc(params.notificationId);
    
    // Make sending idempotent using transaction lock
    try {
      await admin.firestore().runTransaction(async (tx) => {
        const snap = await tx.get(notificationRef);
        const notificationData = snap.data();
        
        if (notificationData?.pushed === true) {
          logger.info("Notification already sent (transaction check)", {
            userId: params.userId,
            notificationId: params.notificationId,
          });
          throw new Error("ALREADY_SENT");
        }
        
        if (notificationData?.status === "sending" && 
            notificationData.sendingAt && 
            Date.now() - notificationData.sendingAt.toMillis() < 60000) {
          logger.info("Notification is already being sent (transaction check)", {
            userId: params.userId,
            notificationId: params.notificationId,
          });
          throw new Error("IN_PROGRESS");
        }
        
        tx.update(notificationRef, {
          status: "sending",
          sendingAt: admin.firestore.FieldValue.serverTimestamp(),
          attempts: admin.firestore.FieldValue.increment(1),
        });
      });
    } catch (error: any) {
      if (error.message === "ALREADY_SENT" || error.message === "IN_PROGRESS") {
        logger.info(`Notification skipped: ${error.message}`, {
          userId: params.userId,
          notificationId: params.notificationId,
        });
        return;
      }
      logger.error("Failed to acquire transaction lock for sending notification", {
        error: error.message,
        errorCode: error.code,
        userId: params.userId,
        notificationId: params.notificationId,
      });
      return;
    }

    let title: string;
    let body: string;

    // Determine title and body based on notification type
    switch (data.type) {
      case "new_message":
        title = data.senderName
          ? `Mesaj nou de la ${data.senderName}`
          : "Mesaj nou";
        body = data.message || "Ai primit un mesaj nou.";
        break;
      case "new_support_chat":
        title = data.senderName
          ? `Cerere suport nouă de la ${data.senderName}`
          : "Cerere suport nouă";
        body = data.message || "Ai primit o nouă cerere de suport.";
        break;
      case "support_resolved":
        title = "Cerere suport rezolvată";
        body = data.message || "Cererea de suport a fost marcată ca rezolvată.";
        break;
      case "outbid":
        title = "Ai fost depășit la licitație";
        body = data.message || "Cineva a plasat o licitare mai mare.";
        break;
      case "auction_won":
        title = "Ai câștigat licitația!";
        body = data.message || "Felicitări! Ai câștigat licitația.";
        break;
      case "auction_ended_no_win":
        title = "Licitație încheiată";
        body = data.message || "Licitația s-a încheiat.";
        break;
      case "conversation_started":
        title = data.senderName
          ? `Conversație nouă de la ${data.senderName}`
          : "Conversație nouă";
        body = data.message || "Ai o conversație nouă.";
        break;
      case "new_offer":
        title = data.senderName
          ? `Ofertă nouă de la ${data.senderName}`
          : "Ofertă nouă";
        body = data.message || "Ai primit o ofertă nouă.";
        break;
      case "contract_created":
        title = "Contract creat";
        body = data.message || "A fost creat un contract nou.";
        break;
      case "contract_accepted":
        title = "Contract acceptat";
        body = data.message || "Un contract a fost acceptat.";
        break;
      case "contract_rejected":
      case "contract_cancelled":
        title = "Contract respins/anulat";
        body = data.message || "Un contract a fost respins sau anulat.";
        break;
      case "contract_disputed":
        title = "Dispută contract";
        body = data.message || "A fost deschisă o dispută pe contract.";
        break;
      case "contract_dispute_resolved":
        title = "Dispută rezolvată";
        body = data.message || "Disputa contractului a fost rezolvată.";
        break;
      case "system":
        title = data.title || "Actualizare";
        body = data.message || "Ai o notificare nouă.";
        break;
      default:
        logger.info("Skipping unknown notification type", {
          userId: params.userId,
          notificationId: params.notificationId,
          type: data.type,
        });
        return;
    }

    logger.info("Processing notification", {
      userId: params.userId,
      notificationId: params.notificationId,
      type: data.type,
      title,
      body,
    });

    // Fetch devices with retry logic for transient errors
    let devicesSnap;
    try {
      devicesSnap = await retryWithBackoff(async () => {
        return await admin
          .firestore()
          .collection("users")
          .doc(params.userId)
          .collection("devices")
          .get();
      }, 3, 1000);
    } catch (error) {
      logger.error("Failed to fetch devices after retries", {
        error: (error as any)?.message,
        errorCode: (error as any)?.code,
        userId: params.userId,
        notificationId: params.notificationId,
      });
      return;
    }

    if (devicesSnap.empty) {
      logger.info("No devices for push", {userId: params.userId});
      logger.info("User has no registered devices - push notification cannot be sent");
      return;
    }

    logger.info(`Found ${devicesSnap.size} devices for user ${params.userId}`);
    logger.info("Device IDs:", devicesSnap.docs.map(doc => doc.id));

    const uniqueTokens = new Set<string>();
    devicesSnap.forEach((doc) => {
      const device = doc.data() as DeviceRecord;
      if (!device.expoPushToken) {
        logger.info("Device without expoPushToken", {deviceId: doc.id});
        return;
      }

      // Validate Expo push token format
      if (typeof device.expoPushToken === "string" && device.expoPushToken.startsWith("ExponentPushToken[")) {
        uniqueTokens.add(device.expoPushToken);
        logger.info("Adding device to push messages", {
          deviceId: doc.id,
          token: device.expoPushToken.substring(0, 20) + "...",
        });
      } else {
        logger.warn("Invalid Expo push token format", {
          deviceId: doc.id,
          token: device.expoPushToken,
        });
      }
    });

    // Debug: Check what notification data is available
    logger.info("Notification data available:", {
      conversationId: data.conversationId,
      hasConversationId: !!data.conversationId,
      supportChatId: data.supportChatId,
      auctionId: data.auctionId,
      productId: data.productId,
      type: data.type
    });

    const messages: ExpoPushMessage[] = [...uniqueTokens].map((token) => ({
      to: token,
      title,
      body,
      channelId: 'default', // Android notification channel ID
      sound: 'default', // Sound to play
      priority: 'high', // Notification priority
      data: {
        conversationId: data.conversationId || null,
        supportChatId: data.supportChatId || null,
        auctionId: data.auctionId || null,
        productId: data.productId || null,
        orderId: data.orderId || null,
        notificationId: snap?.id || null,
        type: data.type,
        offerId: data.offerId || null,
        itemType: data.itemType || null,
        itemId: data.itemId || null,
        deepLink: data.deepLink || null,
        url: data.url || null,
      },
    }));

    logger.info(`Sending ${messages.length} push notifications to Expo`);
    logger.info("Push message preview:", messages.map(msg => ({
      to: msg.to.substring(0, 20) + '...',
      title: msg.title,
      body: msg.body.substring(0, 50) + '...',
      channelId: msg.channelId,
      priority: msg.priority,
    })));

    const sendResult = await sendExpoPushNotifications(messages);
    const ticketIds = sendResult.ticketIds;

    // Mark as sent only if at least one ticket was accepted by Expo.
    // If all tickets fail, keep a retryable error state.
    try {
      if (sendResult.successCount > 0) {
        await retryWithBackoff(async () => {
          await notificationRef.update({
            pushed: true,
            status: sendResult.errorCount > 0 ? "sent_with_errors" : "sent",
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            // Store ticket IDs for async receipt inspection worker
            expoTicketIds: ticketIds.length > 0 ? ticketIds : admin.firestore.FieldValue.delete(),
            receiptsCheckStatus: ticketIds.length > 0 ? "pending" : "not_required",
            receiptCheckAttempts: 0,
            expoDeliveryStats: {
              attempted: sendResult.attemptedCount,
              accepted: sendResult.successCount,
              rejected: sendResult.errorCount,
              hadRequestError: sendResult.hadRequestError,
            },
          });
        }, 3, 1000);
      } else {
        await retryWithBackoff(async () => {
          await notificationRef.update({
            pushed: false,
            status: "retryable_error",
            lastDeliveryErrorAt: admin.firestore.FieldValue.serverTimestamp(),
            expoTicketIds: admin.firestore.FieldValue.delete(),
            receiptsCheckStatus: "not_required",
            expoDeliveryStats: {
              attempted: sendResult.attemptedCount,
              accepted: sendResult.successCount,
              rejected: sendResult.errorCount,
              hadRequestError: sendResult.hadRequestError,
            },
          });
        }, 3, 1000);
      }
    } catch (error) {
      logger.error("Failed to mark notification as sent", {
        error: (error as any)?.message,
        errorCode: (error as any)?.code,
        userId: params.userId,
        notificationId: params.notificationId,
      });
    }

    logger.info("Notification sent successfully", {
      userId: params.userId,
      notificationId: params.notificationId,
      acceptedTickets: sendResult.successCount,
      rejectedTickets: sendResult.errorCount,
      ticketIds: ticketIds.length,
    });

    if (sendResult.successCount === 0) {
      logger.warn("All Expo tickets rejected; notification marked retryable_error", {
        userId: params.userId,
        notificationId: params.notificationId,
      });
    }
  }
);

/**
 * Async worker for Expo push receipts.
 *
 * Runs outside the Firestore trigger path to avoid long-running per-notification
 * waits. It checks receipt status for notifications previously marked as
 * receiptsCheckStatus="pending".
 */
export const processExpoPushReceipts = onSchedule(
  {
    region: "europe-west1",
    schedule: "every 2 minutes",
    timeZone: "Europe/Bucharest",
  },
  async () => {
    const db = admin.firestore();
    const pendingReceiptsSnap = await db
      .collectionGroup("notifications")
      .where("receiptsCheckStatus", "==", "pending")
      .limit(200)
      .get();

    if (pendingReceiptsSnap.empty) {
      logger.info("No pending Expo receipts to process");
      return;
    }

    let checked = 0;
    let ready = 0;
    let notReady = 0;
    let failedRequests = 0;

    for (const notificationDoc of pendingReceiptsSnap.docs) {
      const data = notificationDoc.data() as Record<string, unknown>;

      const sentAt = data.sentAt as FirebaseFirestore.Timestamp | undefined;
      if (sentAt && Date.now() - sentAt.toMillis() < 30000) {
        // Expo receipts can lag; skip very fresh sends and retry next cycle.
        continue;
      }

      const rawTicketIds = Array.isArray(data.expoTicketIds) ? data.expoTicketIds : [];
      const ticketIds = rawTicketIds.filter((value): value is string => typeof value === "string" && value.length > 0);

      if (ticketIds.length === 0) {
        await notificationDoc.ref.update({
          receiptsCheckStatus: "not_required",
          receiptsCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
          receiptCheckAttempts: admin.firestore.FieldValue.increment(1),
        });
        checked += 1;
        continue;
      }

      const pathParts = notificationDoc.ref.path.split("/");
      const userId = pathParts.length >= 2 ? pathParts[1] : "unknown";
      const notificationId = pathParts.length >= 4 ? pathParts[3] : notificationDoc.id;

      const receiptResult = await checkExpoPushReceipts(ticketIds, userId, notificationId);

      if (receiptResult.state === "not_ready") {
        await notificationDoc.ref.update({
          receiptCheckAttempts: admin.firestore.FieldValue.increment(1),
          lastReceiptCheckAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        notReady += 1;
        continue;
      }

      if (receiptResult.state === "request_failed") {
        await notificationDoc.ref.update({
          receiptCheckAttempts: admin.firestore.FieldValue.increment(1),
          lastReceiptCheckAt: admin.firestore.FieldValue.serverTimestamp(),
          lastReceiptCheckErrorAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        failedRequests += 1;
        continue;
      }

      await notificationDoc.ref.update({
        receiptsCheckStatus: receiptResult.errorCount > 0 ? "checked_with_errors" : "checked_ok",
        receiptsCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
        receiptCheckAttempts: admin.firestore.FieldValue.increment(1),
        receiptStats: {
          checked: receiptResult.checkedCount,
          ok: receiptResult.okCount,
          errors: receiptResult.errorCount,
        },
      });

      checked += 1;
      ready += 1;
    }

    logger.info("processExpoPushReceipts summary", {
      candidates: pendingReceiptsSnap.size,
      checked,
      ready,
      notReady,
      failedRequests,
    });
  }
);

/**
 * Auto-process orders where buyer marked payment but seller did not confirm in 10 days.
 * Flags admin and moves order to paid automatically.
 */
export const autoResolveUnconfirmedOrderPayments = onSchedule(
  {
    region: "europe-west1",
    schedule: "every 24 hours",
    timeZone: "Europe/Bucharest",
  },
  async () => {
    const db = admin.firestore();
    const cutoffMs = Date.now() - (10 * 24 * 60 * 60 * 1000);
    const cutoff = admin.firestore.Timestamp.fromMillis(cutoffMs);

    const snapshot = await db
      .collection("orders")
      .where("status", "==", "payment_marked_by_buyer")
      .where("buyerMarkedPaidAt", "<=", cutoff)
      .get();

    if (snapshot.empty) {
      logger.info("No overdue payment confirmations found");
      return;
    }

    let processed = 0;
    for (const orderDoc of snapshot.docs) {
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(orderDoc.ref);
        if (!fresh.exists) return;
        const data = fresh.data() as any;
        if (data.status !== "payment_marked_by_buyer") return;

        const flagRef = db.collection("adminPaymentFlags").doc();
        tx.update(orderDoc.ref, {
          status: "paid",
          paymentFlaggedForAdmin: true,
          paymentFlaggedAt: admin.firestore.FieldValue.serverTimestamp(),
          autoPaidBySystem: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        tx.set(flagRef, {
          type: "order_payment_timeout_auto_paid",
          orderId: orderDoc.id,
          buyerId: data.buyerId || null,
          sellerId: data.sellerId || null,
          buyerMarkedPaidAt: data.buyerMarkedPaidAt || null,
          note: "Seller did not confirm payment within 10 days; order auto-marked paid.",
          status: "open",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        processed += 1;
      });
    }

    logger.info("Processed overdue payment confirmations", {processed});
  }
);

/**
 * Server-side auction finalization.
 *
 * Ensures auctions that reached endTime are closed even if no client/admin action runs,
 * then dispatches winner/loser notifications + winner/seller emails.
 */
export const finalizeEndedAuctions = onSchedule(
  {
    region: "europe-west1",
    schedule: "every 5 minutes",
    timeZone: "Europe/Bucharest",
  },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    const toFinalizeSnap = await db
      .collection("auctions")
      .where("status", "==", "active")
      .where("endTime", "<=", now)
      .limit(100)
      .get();

    let finalizedCount = 0;
    for (const auctionDoc of toFinalizeSnap.docs) {
      const finalized = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(auctionDoc.ref);
        if (!fresh.exists) return false;

        const data = (fresh.data() || {}) as Record<string, unknown>;
        const status = typeof data.status === "string" ? data.status : "";
        if (status !== "active") return false;

        const endTimeValue = data.endTime as FirebaseFirestore.Timestamp | undefined;
        if (endTimeValue && endTimeValue.toMillis() > Date.now()) {
          return false;
        }

        const currentBid = Number(data.currentBid || 0);
        const reservePrice = Number(data.reservePrice || 0);
        const minAcceptPrice = typeof data.minAcceptPrice === "number"
          ? Number(data.minAcceptPrice)
          : reservePrice;
        const didMeetMinimum = currentBid >= minAcceptPrice;

        const currentBidderId = typeof data.currentBidderId === "string"
          ? data.currentBidderId
          : null;
        const winnerId = didMeetMinimum && currentBidderId ? currentBidderId : null;

        tx.update(auctionDoc.ref, {
          status: "ended",
          winnerId,
          didMeetMinimum,
          resultNotificationStatus: "pending",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return true;
      });

      if (finalized) finalizedCount += 1;
    }

    const pendingResultsSnap = await db
      .collection("auctions")
      .where("status", "==", "ended")
      .where("resultNotificationStatus", "==", "pending")
      .limit(100)
      .get();

    let notifiedCount = 0;
    for (const auctionDoc of pendingResultsSnap.docs) {
      try {
        await dispatchAuctionResultNotifications(auctionDoc.id);
        notifiedCount += 1;
      } catch (error) {
        logger.error("Failed to dispatch auction result notifications", {
          auctionId: auctionDoc.id,
          error,
        });
      }
    }

    logger.info("finalizeEndedAuctions summary", {
      candidates: toFinalizeSnap.size,
      finalizedCount,
      pendingToNotify: pendingResultsSnap.size,
      notifiedCount,
    });
  },
);
