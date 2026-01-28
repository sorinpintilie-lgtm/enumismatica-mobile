import * as admin from "firebase-admin";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";

admin.initializeApp();

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface NotificationDoc {
  type?: string;
  pushed?: boolean;
  senderName?: string;
  message?: string;
  conversationId?: string;
  auctionId?: string;
}

interface DeviceRecord {
  expoPushToken?: string;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: {
    conversationId: string | null;
    auctionId: string | null;
    notificationId: string | null;
    type: string | undefined;
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
 * Send Expo push notifications for new chat message notifications.
 */
export const sendChatMessagePush = onDocumentCreated(
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

    if (data.pushed === true) {
      logger.info("Notification already pushed", {
        userId: params.userId,
        notificationId: params.notificationId,
      });
      return;
    }

    if (data.type !== "new_message") {
      logger.info("Skipping non-message notification", {
        userId: params.userId,
        notificationId: params.notificationId,
        type: data.type,
      });
      return;
    }

    const title = data.senderName
      ? `Mesaj nou de la ${data.senderName}`
      : "Mesaj nou";
    const body = data.message || "Ai primit un mesaj nou.";

    logger.info("Processing chat message notification", {
      userId: params.userId,
      notificationId: params.notificationId,
      title,
      body,
    });

    const devicesSnap = await admin
      .firestore()
      .collection("users")
      .doc(params.userId)
      .collection("devices")
      .get();

    if (devicesSnap.empty) {
      logger.info("No devices for push", {userId: params.userId});
      return;
    }

    logger.info(`Found ${devicesSnap.size} devices for user ${params.userId}`);

    const messages: ExpoPushMessage[] = [];

    devicesSnap.forEach((doc) => {
      const device = doc.data() as DeviceRecord;
      if (!device.expoPushToken) {
        logger.info("Device without expoPushToken", {deviceId: doc.id});
        return;
      }

      logger.info("Adding device to push messages", {
        deviceId: doc.id,
        token: device.expoPushToken.substring(0, 20) + "...",
      });

      messages.push({
        to: device.expoPushToken,
        title,
        body,
        data: {
          conversationId: data.conversationId || null,
          auctionId: data.auctionId || null,
          notificationId: snap?.id || null,
          type: data.type,
        },
      });
    });

    logger.info(`Sending ${messages.length} push notifications to Expo`);

    await sendExpoPushNotifications(messages);

    if (snap?.ref) {
      await snap.ref.update({
        pushed: true,
      });
      logger.info("Marked notification as pushed", {
        userId: params.userId,
        notificationId: params.notificationId,
      });
    }
  }
);
