import { Platform } from 'react-native';
import { db, doc, setDoc, deleteDoc, serverTimestamp } from '@shared/firebaseConfig';
import { getPushToken, requestNotificationPermissions } from './notificationService';

type DeviceRegistration = {
  expoPushToken: string;
  platform: string;
  updatedAt: ReturnType<typeof serverTimestamp>;
};

export async function registerPushTokenForUser(userId: string) {
  if (!userId) {
    console.log('[pushTokenService] No userId provided, skipping registration');
    return;
  }
  if (Platform.OS === 'web') {
    console.log('[pushTokenService] Web platform, skipping registration');
    return;
  }

  console.log('[pushTokenService] Starting push token registration for user:', userId);
  console.log('[pushTokenService] Platform:', Platform.OS);

  const granted = await requestNotificationPermissions();
  if (!granted) {
    console.log('[pushTokenService] Notification permissions not granted - cannot register push token');
    console.log('[pushTokenService] This is a critical issue - push notifications will not work');
    return;
  }

  console.log('[pushTokenService] Permissions granted, proceeding to get push token...');

  const expoPushToken = await getPushToken();
  if (!expoPushToken) {
    console.log('[pushTokenService] No expoPushToken retrieved - cannot register device');
    console.log('[pushTokenService] This is a critical issue - push notifications will not work');
    return;
  }

  console.log('[pushTokenService] Push token retrieved successfully, registering device...');

  // Use a simpler document ID to avoid issues with special characters
  const deviceDocId = `${Platform.OS}-${expoPushToken.substring(0, 20)}`;
  const deviceRef = doc(db, 'users', userId, 'devices', deviceDocId);

  const payload: DeviceRegistration = {
    expoPushToken,
    platform: Platform.OS,
    updatedAt: serverTimestamp(),
  };

  console.log('[pushTokenService] Registering device:', deviceDocId);
  console.log('[pushTokenService] Device payload:', {
    platform: Platform.OS,
    tokenLength: expoPushToken.length,
    tokenPrefix: expoPushToken.substring(0, 20),
  });

  try {
    await setDoc(deviceRef, payload, { merge: true });
    console.log('[pushTokenService] Successfully registered device token for user:', userId);
    console.log('[pushTokenService] Device document path:', `users/${userId}/devices/${deviceDocId}`);
    console.log('[pushTokenService] Device is now ready to receive push notifications');
  } catch (error) {
    console.error('[pushTokenService] Failed to register device token:', error);
    console.error('[pushTokenService] Error details:', {
      code: (error as any)?.code,
      message: (error as any)?.message,
      userId,
      deviceDocId,
    });
    console.error('[pushTokenService] This is a critical issue - push notifications will not work');
  }
}

export async function unregisterPushTokenForUser(userId: string) {
  if (!userId) return;
  if (Platform.OS === 'web') return;

  const expoPushToken = await getPushToken();
  if (!expoPushToken) return;

  // Use the same document ID format as registration
  const deviceDocId = `${Platform.OS}-${expoPushToken.substring(0, 20)}`;
  const deviceRef = doc(db, 'users', userId, 'devices', deviceDocId);

  try {
    await deleteDoc(deviceRef);
    console.log('[pushTokenService] Successfully removed device token for user:', userId);
  } catch (error) {
    console.error('[pushTokenService] Failed to remove device token:', error);
  }
}
