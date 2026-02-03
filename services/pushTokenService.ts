import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { db, doc, setDoc, deleteDoc, serverTimestamp } from '@shared/firebaseConfig';
import { requestNotificationPermissions, ensureNotificationChannelCreated } from './notificationService';

type DeviceRegistration = {
  expoPushToken?: string | null;
  expoPushTokenRaw?: any | null;
  devicePushToken?: string | null;
  devicePushTokenRaw?: any | null;
  platform: string;
  isDevice: boolean;
  modelName: string | null;
  permStatus: string | null;
  tokenError: string | null;
  projectId: string | null;
  tokenFetchedAt?: ReturnType<typeof serverTimestamp>;
  createdAt: ReturnType<typeof serverTimestamp>;
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
  console.log('[pushTokenService] isDevice:', Device.isDevice);

  // Generate a unique device ID
  const deviceId = `${Platform.OS}-${Device.modelId ?? 'unknown'}-${Constants.installationId ?? 'noInstallId'}`;

  let expoPushToken: string | null = null;
  let expoPushTokenRaw: any | null = null;
  let devicePushToken: string | null = null;
  let devicePushTokenRaw: any | null = null;
  let permStatus: string | null = null;
  let tokenError: string | null = null;
  let projectId: string | null = null;

  try {
    // On Android, we need to create notification channel before requesting permissions
    if (Platform.OS === 'android') {
      await ensureNotificationChannelCreated();
    }

    // Request permissions
    const granted = await requestNotificationPermissions();
    permStatus = granted ? 'granted' : 'denied';
    console.log('[pushTokenService] Permission status:', permStatus);

    // Get project ID
    projectId = Constants.expoConfig?.extra?.eas?.projectId
      ?? Constants.easConfig?.projectId
      ?? 'f4fa174b-8702-4031-b9b3-e72887532885';
    console.log('[pushTokenService] Project ID:', projectId);

    // Get push token only if permissions are granted
    if (granted) {
      // Get device push token (FCM token on Android, APNS on iOS)
      console.log('[pushTokenService] Getting device push token...');
      const deviceTokenRes = await Notifications.getDevicePushTokenAsync();
      console.log('[pushTokenService] Device push token response:', JSON.stringify(deviceTokenRes, null, 2));
      devicePushToken = deviceTokenRes?.data ?? null;
      devicePushTokenRaw = deviceTokenRes ?? null;

      // Get Expo push token
      console.log('[pushTokenService] Getting Expo push token...');
      const expoTokenRes = await Notifications.getExpoPushTokenAsync({ 
        projectId: projectId as string 
      });
      console.log('[pushTokenService] Expo push token response:', JSON.stringify(expoTokenRes, null, 2));
      expoPushToken = expoTokenRes?.data ?? null;
      expoPushTokenRaw = expoTokenRes ?? null;

      // Check if we got a valid Expo token
      if (!expoPushToken || expoPushToken.trim() === '') {
        tokenError = 'Failed to retrieve valid push token from Expo';
        console.error('[pushTokenService]', tokenError);
        expoPushToken = null;
      }
    } else {
      console.log('[pushTokenService] Skipping push token retrieval - permissions denied');
    }
  } catch (e: any) {
    tokenError = e?.message ?? String(e);
    console.log('[pushTokenService] Push token error:', tokenError);
  }

  // Always write the device document, even if token is null
  const deviceRef = doc(db, 'users', userId, 'devices', deviceId);

  const payload: any = {
    expoPushToken,
    expoPushTokenRaw,
    devicePushToken,
    devicePushTokenRaw,
    platform: Platform.OS,
    isDevice: Device.isDevice,
    modelName: Device.modelName ?? null,
    permStatus,
    tokenError,
    projectId,
    tokenFetchedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  console.log('[pushTokenService] Registering device:', deviceId);
  console.log('[pushTokenService] Device payload:', {
    platform: Platform.OS,
    isDevice: Device.isDevice,
    modelName: Device.modelName,
    hasExpoToken: !!expoPushToken,
    hasDeviceToken: !!devicePushToken,
    permStatus,
    hasError: !!tokenError,
    projectId,
  });

  try {
    await setDoc(deviceRef, payload, { merge: true });
    console.log('[pushTokenService] Successfully registered device for user:', userId);
    console.log('[pushTokenService] Device document path:', `users/${userId}/devices/${deviceId}`);
    
    // Set up listener to update token if it becomes available later
    const tokenListener = Notifications.addPushTokenListener(async (token) => {
      console.log('[pushTokenService] Push token listener received token:', token);
      await setDoc(deviceRef, {
        expoPushToken: token?.data ?? null,
        expoPushTokenRaw: token ?? null,
        tokenFetchedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });

    // Clean up listener after some time (optional but recommended)
    setTimeout(() => {
      tokenListener.remove();
      console.log('[pushTokenService] Push token listener removed');
    }, 30000); // Remove after 30 seconds

    if (expoPushToken) {
      console.log('[pushTokenService] Device is ready to receive push notifications');
    } else {
      console.log('[pushTokenService] Device registered but no push token - notifications may not work');
      console.log('[pushTokenService] Check permStatus and tokenError for diagnostics');
    }
  } catch (error) {
    console.error('[pushTokenService] Failed to register device:', error);
    console.error('[pushTokenService] Error details:', {
      code: (error as any)?.code,
      message: (error as any)?.message,
      userId,
      deviceId,
    });
    console.error('[pushTokenService] This is a critical issue - push notifications will not work');
  }
}

export async function unregisterPushTokenForUser(userId: string) {
  if (!userId) return;
  if (Platform.OS === 'web') return;

  try {
    // Generate the same device ID as registration
    const deviceId = `${Platform.OS}-${Device.modelId ?? 'unknown'}-${Constants.installationId ?? 'noInstallId'}`;
    const deviceRef = doc(db, 'users', userId, 'devices', deviceId);

    await deleteDoc(deviceRef);
    console.log('[pushTokenService] Successfully removed device for user:', userId);
  } catch (error) {
    console.warn('[pushTokenService] Failed to unregister device (ignoring):', error);
    // Do not rethrow - this should not prevent login/logout
  }
}