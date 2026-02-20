import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Application from 'expo-application';
import { db, doc, setDoc, deleteDoc, serverTimestamp } from '@shared/firebaseConfig';
import { requestNotificationPermissions, ensureNotificationChannelCreated } from './notificationService';

// Global listener reference to prevent multiple listeners
let pushTokenListener: Notifications.Subscription | null = null;

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

  // Generate a stable device ID
  // On Android: use Application.getAndroidId() which is stable across app reinstalls
  // On iOS: use Application.getIosIdForVendorAsync() which is the vendor ID
  // Fallback to installationId if all else fails
  let deviceId: string;
  
  try {
    if (Platform.OS === 'android') {
      deviceId = `android-${Application.getAndroidId()}`;
    } else if (Platform.OS === 'ios') {
      const iosId = await Application.getIosIdForVendorAsync();
      deviceId = iosId ? `ios-${iosId}` : `${Platform.OS}-${Constants.installationId ?? 'noInstallId'}`;
    } else {
      deviceId = `${Platform.OS}-${Device.modelId ?? 'unknown'}-${Constants.installationId ?? 'noInstallId'}`;
    }
  } catch (error) {
    console.warn('[pushTokenService] Failed to get stable device ID, falling back to default:', error);
    deviceId = `${Platform.OS}-${Device.modelId ?? 'unknown'}-${Constants.installationId ?? 'noInstallId'}`;
  }

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
      // Get device push token (FCM on Android only - skip on iOS to avoid conflicts with Firebase)
      if (Platform.OS === 'android') {
        try {
          console.log('[pushTokenService] Getting device push token (Android)...');
          const deviceTokenRes = await Notifications.getDevicePushTokenAsync();
          console.log('[pushTokenService] Device push token response:', JSON.stringify(deviceTokenRes, null, 2));
          devicePushToken = deviceTokenRes?.data ?? null;
          devicePushTokenRaw = deviceTokenRes ?? null;
        } catch (deviceTokenError: any) {
          console.warn('[pushTokenService] Failed to get device push token (non-fatal):', deviceTokenError?.message);
        }
      }

      // Get Expo push token - this is the token used for sending notifications
      // Retry up to 3 times with increasing delay (APNs registration can be async on iOS)
      console.log('[pushTokenService] Getting Expo push token...');
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          if (attempt > 1) {
            const delayMs = attempt * 2000;
            console.log(`[pushTokenService] Retrying Expo push token (attempt ${attempt}/${maxAttempts}) after ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
          const expoTokenRes = await Notifications.getExpoPushTokenAsync({
            projectId: projectId as string
          });
          console.log('[pushTokenService] Expo push token response:', JSON.stringify(expoTokenRes, null, 2));
          expoPushToken = expoTokenRes?.data ?? null;
          expoPushTokenRaw = expoTokenRes ?? null;

          // Check if we got a valid Expo token
          if (!expoPushToken || expoPushToken.trim() === '') {
            tokenError = 'Failed to retrieve valid push token from Expo (empty)';
            console.error('[pushTokenService]', tokenError);
            expoPushToken = null;
          } else {
            tokenError = null; // Clear any previous error
            break; // Success - exit retry loop
          }
        } catch (expoTokenError: any) {
          tokenError = expoTokenError?.message ?? String(expoTokenError);
          console.error(`[pushTokenService] Attempt ${attempt}/${maxAttempts} failed to get Expo push token:`, tokenError);
          expoPushToken = null;
          if (attempt === maxAttempts) {
            console.error('[pushTokenService] All attempts to get Expo push token failed. tokenError:', tokenError);
          }
        }
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
    
    // Remove any existing listener before creating a new one
    if (pushTokenListener) {
      pushTokenListener.remove();
      console.log('[pushTokenService] Removed existing push token listener');
    }
    
    // Set up listener to update token if it becomes available later
    pushTokenListener = Notifications.addPushTokenListener(async (token) => {
      console.log('[pushTokenService] Push token listener received token:', token);
      await setDoc(deviceRef, {
        expoPushToken: token?.data ?? null,
        expoPushTokenRaw: token ?? null,
        tokenFetchedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });

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
    // Remove the push token listener
    if (pushTokenListener) {
      pushTokenListener.remove();
      pushTokenListener = null;
      console.log('[pushTokenService] Removed push token listener during unregister');
    }

    // Generate the same device ID as registration
    let deviceId: string;
    
    try {
      if (Platform.OS === 'android') {
        deviceId = `android-${Application.getAndroidId()}`;
      } else if (Platform.OS === 'ios') {
        const iosId = await Application.getIosIdForVendorAsync();
        deviceId = iosId ? `ios-${iosId}` : `${Platform.OS}-${Constants.installationId ?? 'noInstallId'}`;
      } else {
        deviceId = `${Platform.OS}-${Device.modelId ?? 'unknown'}-${Constants.installationId ?? 'noInstallId'}`;
      }
    } catch (error) {
      console.warn('[pushTokenService] Failed to get stable device ID, falling back to default:', error);
      deviceId = `${Platform.OS}-${Device.modelId ?? 'unknown'}-${Constants.installationId ?? 'noInstallId'}`;
    }

    const deviceRef = doc(db, 'users', userId, 'devices', deviceId);
    await deleteDoc(deviceRef);
    console.log('[pushTokenService] Successfully removed device for user:', userId);
  } catch (error) {
    console.warn('[pushTokenService] Failed to unregister device (ignoring):', error);
    // Do not rethrow - this should not prevent login/logout
  }
}