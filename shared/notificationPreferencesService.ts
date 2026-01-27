import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { UserNotificationPreferences } from './types';

export const defaultNotificationPreferences: UserNotificationPreferences = {
  pushEnabled: true,
  auctionOutbid: true,
  auctionWon: true,
  auctionEndedNoWin: true,
  watchlistUpdates: true,
  offerUpdates: true,
  orderUpdates: true,
  messageUpdates: true,
  systemUpdates: true,
  marketingUpdates: false,
};

const normalizePreferences = (raw?: Partial<UserNotificationPreferences> | null): UserNotificationPreferences => ({
  ...defaultNotificationPreferences,
  ...(raw || {}),
});

export async function getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences> {
  if (!db) return defaultNotificationPreferences;

  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    return defaultNotificationPreferences;
  }

  const data = snap.data() as any;
  return normalizePreferences(data.notificationPreferences);
}

export async function updateUserNotificationPreferences(
  userId: string,
  updates: Partial<UserNotificationPreferences>,
): Promise<UserNotificationPreferences> {
  if (!db) return normalizePreferences(updates);

  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  const current = snap.exists() ? normalizePreferences((snap.data() as any).notificationPreferences) : defaultNotificationPreferences;
  const next = normalizePreferences({ ...current, ...updates });

  await updateDoc(userRef, {
    notificationPreferences: next,
    updatedAt: serverTimestamp(),
  });

  return next;
}

export async function shouldSendNotification(
  userId: string,
  key: keyof UserNotificationPreferences,
): Promise<boolean> {
  const prefs = await getUserNotificationPreferences(userId);
  return prefs.pushEnabled && prefs[key];
}
