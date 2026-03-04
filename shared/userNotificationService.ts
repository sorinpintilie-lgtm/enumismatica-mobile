import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { ChatNotification, UserNotificationPreferences } from './types';
import { shouldSendNotification } from './notificationPreferencesService';

type NotificationPreferenceKey = keyof UserNotificationPreferences;

type CreateUserNotificationInput = {
  userId: string;
  type: ChatNotification['type'];
  title?: string;
  message: string;
  preferenceKey?: NotificationPreferenceKey;
  data?: Record<string, unknown>;
};

/**
 * Creates a notification document in users/{uid}/notifications.
 *
 * If `preferenceKey` is provided, the notification is only created when the
 * user allows that category (and push is enabled globally).
 */
export async function createUserNotification(input: CreateUserNotificationInput): Promise<string | null> {
  if (!db) throw new Error('Firestore not initialized');

  if (input.preferenceKey) {
    const allowed = await shouldSendNotification(input.userId, input.preferenceKey);
    if (!allowed) return null;
  }

  const payload: Record<string, unknown> = {
    userId: input.userId,
    type: input.type,
    message: input.message,
    read: false,
    pushed: false,
    createdAt: serverTimestamp(),
  };

  if (input.title) {
    payload.title = input.title;
  }

  if (input.data) {
    Object.entries(input.data).forEach(([key, value]) => {
      if (value !== undefined) {
        payload[key] = value;
      }
    });
  }

  const notificationsRef = collection(db, 'users', input.userId, 'notifications');
  const created = await addDoc(notificationsRef, payload);
  return created.id;
}

