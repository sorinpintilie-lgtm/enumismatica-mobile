
import * as admin from "firebase-admin";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
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

interface NotificationDoc {
  type?: string;
  pushed?: boolean;
  senderName?: string;
  message?: string;
  conversationId?: string;
  auctionId?: string;
  offerId?: string;
  itemType?: string;
  itemId?: string;
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
    auctionId: string | null;
    notificationId: string | null;
    type: string | undefined;
    offerId?: string | null;
    itemType?: string | null;
    itemId?: string | null;
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

/**
 * Send Expo push notifications in batches of 100.
 * Parses and logs individual ticket errors so delivery failures are visible.
 * Returns array of ticket IDs for optional receipt checking.
 */
async function sendExpoPushNotifications(
  messages: ExpoPushMessage[]
): Promise<string[]> {
  if (messages.length === 0) return [];

  const chunks = chunkArray(messages, 100);
  const allTicketIds: string[] = [];

  await Promise.all(
    chunks.map(async (chunk) => {
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
        return;
      }

      // Parse the response to check individual ticket statuses
      let parsed: ExpoPushResponse | null = null;
      try {
        parsed = JSON.parse(bodyText) as ExpoPushResponse;
      } catch {
        logger.error("Failed to parse Expo push response", { body: bodyText });
        return;
      }

      const tickets = parsed?.data ?? [];
      let successCount = 0;
      let errorCount = 0;

      tickets.forEach((ticket, idx) => {
        if (ticket.status === "ok") {
          successCount++;
          if (ticket.id) allTicketIds.push(ticket.id);
        } else {
          errorCount++;
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
        successTickets: successCount,
        errorTickets: errorCount,
      });
    })
  );

  return allTicketIds;
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

    const messages: ExpoPushMessage[] = [...uniqueTokens].map((token) => ({
      to: token,
      title,
      body,
      channelId: 'default', // Android notification channel ID
      sound: 'default', // Sound to play
      priority: 'high', // Notification priority
      data: {
        conversationId: data.conversationId || null,
        auctionId: data.auctionId || null,
        notificationId: snap?.id || null,
        type: data.type,
        offerId: data.offerId || null,
        itemType: data.itemType || null,
        itemId: data.itemId || null,
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

    await sendExpoPushNotifications(messages);

    // Mark as sent after successful delivery
    try {
      await retryWithBackoff(async () => {
        await notificationRef.update({
          pushed: true,
          status: "sent",
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }, 3, 1000);
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
