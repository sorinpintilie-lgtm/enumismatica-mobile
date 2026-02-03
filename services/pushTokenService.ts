import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { db, doc, setDoc, deleteDoc, serverTimestamp } from '@shared/firebaseConfig';
import { getPushToken, requestNotificationPermissions, ensureNotificationChannelCreated } from './notificationService';

type DeviceRegistration = {
  expoPushToken: string | null;
  platform: string;
  isDevice: boolean;
  modelName: string | null;
  permStatus: string | null;
  tokenError: string | null;
  projectId: string | null;
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
      expoPushToken = await getPushToken();
      console.log('[pushTokenService] Push token retrieved:', expoPushToken ? `${expoPushToken.substring(0, 20)}...` : 'null');
    } else {
      console.log('[pushTokenService] Skipping push token retrieval - permissions denied');
    }
  } catch (e: any) {
    tokenError = e?.message ?? String(e);
    console.log('[pushTokenService] Push token error:', tokenError);
  }

  // Always write the device document, even if token is null
  const deviceRef = doc(db, 'users', userId, 'devices', deviceId);

  const payload: DeviceRegistration = {
    expoPushToken,
    platform: Platform.OS,
    isDevice: Device.isDevice,
    modelName: Device.modelName ?? null,
    permStatus,
    tokenError,
    projectId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  console.log('[pushTokenService] Registering device:', deviceId);
  console.log('[pushTokenService] Device payload:', {
    platform: Platform.OS,
    isDevice: Device.isDevice,
    modelName: Device.modelName,
    hasToken: !!expoPushToken,
    permStatus,
    hasError: !!tokenError,
    projectId,
  });

  try {
    await setDoc(deviceRef, payload, { merge: true });
    console.log('[pushTokenService] Successfully registered device for user:', userId);
    console.log('[pushTokenService] Device document path:', `users/${userId}/devices/${deviceId}`);
    
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