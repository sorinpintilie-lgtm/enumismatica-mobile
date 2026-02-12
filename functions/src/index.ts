
import * as admin from "firebase-admin";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {onRequest} from "firebase-functions/v2/https";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

// Initialize Firebase Admin SDK
// Uses default credentials which are automatically available in Cloud Functions environment
admin.initializeApp();

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CREDIT_PRICE_RON = 1;

type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";

interface NetopiaPaymentDoc {
  userId: string;
  status: PaymentStatus;
  ronAmount: number;
  creditsToAdd: number;
  paymentReference: string;
  provider: "netopia";
  netopiaSignatureValid: boolean;
  createdAt: FirebaseFirestore.FieldValue;
  updatedAt: FirebaseFirestore.FieldValue;
  completedAt?: FirebaseFirestore.FieldValue;
  callbackRaw?: unknown;
}

function calcCreditsFromRon(ronAmount: number): number {
  if (!ronAmount || ronAmount <= 0) return 0;
  return Math.floor(ronAmount / CREDIT_PRICE_RON);
}

function getBearerToken(req: any): string | null {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== "string") return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1];
}

async function getUidFromRequest(req: any): Promise<string> {
  const token = getBearerToken(req);
  if (!token) throw new Error("Missing Authorization token");
  const decoded = await admin.auth().verifyIdToken(token);
  return decoded.uid;
}

function buildNetopiaPlaceholderUrl(paymentId: string): string {
  return `https://sandboxsecure.mobilpay.ro/?paymentId=${encodeURIComponent(paymentId)}`;
}

export const initNetopiaPayment = onRequest({region: "europe-west1"}, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({error: "Method not allowed"});
    return;
  }

  try {
    const uid = await getUidFromRequest(req);
    const ronAmountRaw = Number(req.body?.ronAmount);
    if (!Number.isFinite(ronAmountRaw) || ronAmountRaw <= 0) {
      res.status(400).json({error: "Invalid ronAmount"});
      return;
    }

    const ronAmount = Math.round(ronAmountRaw * 100) / 100;
    const creditsToAdd = calcCreditsFromRon(ronAmount);
    if (creditsToAdd <= 0) {
      res.status(400).json({error: "Amount too small for at least 1 credit"});
      return;
    }

    const paymentsCol = admin.firestore().collection("creditPayments");
    const paymentRef = paymentsCol.doc();
    const paymentReference = `netopia_${paymentRef.id}`;

    const docData: NetopiaPaymentDoc = {
      userId: uid,
      status: "pending",
      ronAmount,
      creditsToAdd,
      paymentReference,
      provider: "netopia",
      netopiaSignatureValid: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await paymentRef.set(docData);

    res.status(200).json({
      paymentId: paymentRef.id,
      paymentReference,
      paymentUrl: buildNetopiaPlaceholderUrl(paymentRef.id),
    });
  } catch (error: any) {
    logger.error("initNetopiaPayment failed", {error: error?.message || error});
    res.status(401).json({error: error?.message || "Unauthorized"});
  }
});

export const initNetopiaPaymentCallable = onCall({region: "europe-west1"}, async (request) => {
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

  const paymentsCol = admin.firestore().collection("creditPayments");
  const paymentRef = paymentsCol.doc();
  const paymentReference = `netopia_${paymentRef.id}`;

  const docData: NetopiaPaymentDoc = {
    userId: uid,
    status: "pending",
    ronAmount,
    creditsToAdd,
    paymentReference,
    provider: "netopia",
    netopiaSignatureValid: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await paymentRef.set(docData);

  return {
    paymentId: paymentRef.id,
    paymentReference,
    paymentUrl: buildNetopiaPlaceholderUrl(paymentRef.id),
  };
});

export const getNetopiaPaymentStatus = onRequest({region: "europe-west1"}, async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({error: "Method not allowed"});
    return;
  }

  try {
    const uid = await getUidFromRequest(req);
    const paymentId = String(req.query.paymentId || "").trim();
    if (!paymentId) {
      res.status(400).json({error: "paymentId is required"});
      return;
    }

    const paymentRef = admin.firestore().collection("creditPayments").doc(paymentId);
    const snap = await paymentRef.get();
    if (!snap.exists) {
      res.status(404).json({error: "Payment not found"});
      return;
    }

    const data = snap.data() as any;
    if (data.userId !== uid) {
      res.status(403).json({error: "Forbidden"});
      return;
    }

    res.status(200).json({
      paymentId: snap.id,
      status: data.status,
      creditsAdded: data.status === "paid" ? data.creditsToAdd : 0,
      ronAmount: data.ronAmount,
      paymentReference: data.paymentReference,
    });
  } catch (error: any) {
    logger.error("getNetopiaPaymentStatus failed", {error: error?.message || error});
    res.status(401).json({error: error?.message || "Unauthorized"});
  }
});

export const getNetopiaPaymentStatusCallable = onCall({region: "europe-west1"}, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Missing auth");
  }

  const uid = request.auth.uid;
  const paymentId = String((request.data as any)?.paymentId || "").trim();
  if (!paymentId) {
    throw new HttpsError("invalid-argument", "paymentId is required");
  }

  const paymentRef = admin.firestore().collection("creditPayments").doc(paymentId);
  const snap = await paymentRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Payment not found");
  }

  const data = snap.data() as any;
  if (data.userId !== uid) {
    throw new HttpsError("permission-denied", "Forbidden");
  }

  return {
    paymentId: snap.id,
    status: data.status,
    creditsAdded: data.status === "paid" ? data.creditsToAdd : 0,
    ronAmount: data.ronAmount,
    paymentReference: data.paymentReference,
  };
});

export const netopiaIpnCallback = onRequest({region: "europe-west1"}, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({error: "Method not allowed"});
    return;
  }

  const paymentId = String(req.body?.paymentId || req.query?.paymentId || "").trim();
  const reportedStatus = String(req.body?.status || "").trim().toLowerCase();

  if (!paymentId) {
    res.status(400).json({error: "paymentId is required"});
    return;
  }

  const normalizedStatus: PaymentStatus =
    reportedStatus === "paid" ? "paid" :
    reportedStatus === "failed" ? "failed" :
    reportedStatus === "cancelled" ? "cancelled" :
    "pending";

  const db = admin.firestore();
  const paymentRef = db.collection("creditPayments").doc(paymentId);

  try {
    await db.runTransaction(async (tx) => {
      const paySnap = await tx.get(paymentRef);
      if (!paySnap.exists) {
        throw new Error("Payment not found");
      }

      const payData = paySnap.data() as any;
      const existingStatus = payData.status as PaymentStatus;

      if (existingStatus === "paid") {
        tx.update(paymentRef, {
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          callbackRaw: req.body || null,
        });
        return;
      }

      if (normalizedStatus !== "paid") {
        tx.update(paymentRef, {
          status: normalizedStatus,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          callbackRaw: req.body || null,
          netopiaSignatureValid: false,
        });
        return;
      }

      const userRef = db.collection("users").doc(payData.userId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        throw new Error("User not found");
      }

      const currentCredits = Number(userSnap.data()?.credits || 0);
      const creditsToAdd = Number(payData.creditsToAdd || 0);
      const newCredits = currentCredits + creditsToAdd;

      tx.update(userRef, {
        credits: newCredits,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.update(paymentRef, {
        status: "paid",
        netopiaSignatureValid: false,
        callbackRaw: req.body || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const txRef = db.collection("users").doc(payData.userId).collection("creditTransactions").doc();
      tx.set(txRef, {
        userId: payData.userId,
        type: "purchase_netopia",
        provider: "netopia",
        paymentReference: payData.paymentReference,
        ronAmount: payData.ronAmount,
        amount: creditsToAdd,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    res.status(200).json({ok: true});
  } catch (error: any) {
    logger.error("netopiaIpnCallback failed", {error: error?.message || error, paymentId});
    res.status(500).json({error: error?.message || "Internal error"});
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

/**
 * Send Expo push notifications in batches of 100.
 */
async function sendExpoPushNotifications(
  messages: ExpoPushMessage[]
): Promise<void> {
  if (messages.length === 0) return;

  const chunks = chunkArray(messages, 100);

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
        logger.error("Expo push send failed", {
          status: response.status,
          body: bodyText,
        });
      } else {
        logger.info("Expo push sent", {
          status: response.status,
          body: bodyText,
        });
      }
    })
  );
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
