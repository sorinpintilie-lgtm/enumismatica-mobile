import { Platform } from 'react-native';
import { db, doc, setDoc, serverTimestamp } from '@shared/firebaseConfig';
import { getPushToken, requestNotificationPermissions } from './notificationService';

type DeviceRegistration = {
  expoPushToken: string;
  platform: string;
  updatedAt: ReturnType<typeof serverTimestamp>;
};

export async function registerPushTokenForUser(userId: string) {
  if (!userId) return;
  if (Platform.OS === 'web') return;

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const expoPushToken = await getPushToken();
  if (!expoPushToken) return;

  // Use a simpler document ID to avoid issues with special characters
  const deviceDocId = `${Platform.OS}-${expoPushToken.substring(0, 20)}`;
  const deviceRef = doc(db, 'users', userId, 'devices', deviceDocId);

  const payload: DeviceRegistration = {
    expoPushToken,
    platform: Platform.OS,
    updatedAt: serverTimestamp(),
  };

  await setDoc(deviceRef, payload, { merge: true });
}
