import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Configure notification behavior only on non-web platforms
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// Function to ensure notification channel is created (call this after app is mounted)
export async function ensureNotificationChannelCreated() {
  if (Platform.OS !== 'android') {
    console.log('[notificationService] Not Android, skipping channel creation');
    return;
  }

  console.log('[notificationService] Ensuring Android notification channel is created...');

  try {
    // First, try to get the existing channel
    const existingChannel = await Notifications.getNotificationChannelAsync('default');
    console.log('[notificationService] Existing channel found:', JSON.stringify(existingChannel, null, 2));

    // If channel exists, update it to ensure it has the correct settings
    if (existingChannel) {
      console.log('[notificationService] Updating existing notification channel...');
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        description: 'Notificări implicite pentru eNumismatica',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#e7b73c',
        sound: 'default',
        enableVibrate: true,
        showBadge: false,
      });
      console.log('[notificationService] Android notification channel updated successfully');
    } else {
      // Create new channel if it doesn't exist
      console.log('[notificationService] Creating new Android notification channel...');
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        description: 'Notificări implicite pentru eNumismatica',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#e7b73c',
        sound: 'default',
        enableVibrate: true,
        showBadge: false,
      });
      console.log('[notificationService] Android notification channel created successfully');
    }
  } catch (error) {
    console.error('[notificationService] Failed to ensure notification channel:', error);
    console.error('[notificationService] Channel creation error details:', JSON.stringify(error, null, 2));
  }
}

// Request notification permissions
export async function requestNotificationPermissions() {
  if (Platform.OS === 'web') {
    console.log('[notificationService] Push notifications not supported on web');
    return false;
  }

  console.log('[notificationService] Requesting notification permissions for platform:', Platform.OS);

  // On Android, we need to request permissions properly
  if (Platform.OS === 'android') {
    const { status } = await Notifications.getPermissionsAsync();
    console.log('[notificationService] Android current permission status:', status);
    console.log('[notificationService] Android permission canAskAgain:', (await Notifications.getPermissionsAsync()).canAskAgain);

    if (status !== 'granted') {
      console.log('[notificationService] Requesting Android notification permissions...');
      const { status: newStatus, canAskAgain } = await Notifications.requestPermissionsAsync();
      console.log('[notificationService] Android new permission status:', newStatus);
      console.log('[notificationService] Android canAskAgain after request:', canAskAgain);

      if (newStatus !== 'granted') {
        console.log('[notificationService] Failed to get push token for push notification!');
        console.log('[notificationService] Permission denied - notifications will not work');
        return false;
      }
    }
    console.log('[notificationService] Android notification permissions granted successfully');
    return true;
  }

  // On iOS, just check if permissions are granted
  const { status } = await Notifications.getPermissionsAsync();
  console.log('[notificationService] iOS permission status:', status);
  return status === 'granted';
}

// Get push token
export async function getPushToken() {
  if (Platform.OS === 'web') {
    console.log('[notificationService] Push notifications not supported on web');
    return '';
  }

  // Try to get project ID from Constants, with fallback to hardcoded value
  let projectId = Constants.expoConfig?.extra?.eas?.projectId
    ?? Constants.easConfig?.projectId;

  // Fallback to hardcoded project ID if Constants doesn't have it (common in standalone apps)
  if (!projectId) {
    console.log('[notificationService] Project ID not found in Constants, using fallback');
    projectId = 'f4fa174b-8702-4031-b9b3-e72887532885';
  }

  console.log('[notificationService] Getting push token for platform:', Platform.OS);
  console.log('[notificationService] Project ID:', projectId);
  console.log('[notificationService] Constants.expoConfig:', JSON.stringify(Constants.expoConfig, null, 2));
  console.log('[notificationService] Constants.easConfig:', JSON.stringify(Constants.easConfig, null, 2));

  if (!projectId) {
    console.error('[notificationService] No project ID found in app config');
    console.error('[notificationService] This will prevent push notifications from working');
    console.error('[notificationService] Please ensure that project ID is set in app.json under extra.eas.projectId');
    return '';
  }

  try {
    console.log('[notificationService] Calling Notifications.getExpoPushTokenAsync with projectId:', projectId);
    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    console.log('[notificationService] Push token retrieved successfully:', token.data ? `${token.data.substring(0, 20)}...` : 'null');
    console.log('[notificationService] Full token data:', JSON.stringify(token, null, 2));
    return token.data;
  } catch (error) {
    console.error('[notificationService] Error getting push token:', error);
    console.error('[notificationService] Error details:', JSON.stringify(error, null, 2));
    console.error('[notificationService] This will prevent push notifications from working');
    return '';
  }
}

// Schedule auction reminder notification (simplified - just send immediate for now)
export async function scheduleAuctionReminder(auctionId: string, auctionTitle: string, endTime: Date) {
  if (Platform.OS === 'web') {
    console.log('Push notifications not supported on web');
    return;
  }
  // For now, just send an immediate notification when called
  // In a real app, you'd want to schedule this properly
  await sendNotification(
    'Auction Reminder Set',
    `${auctionTitle} reminder scheduled for 15 minutes before end`,
    { auctionId, type: 'auction_reminder' }
  );
}

// Send immediate notification
export async function sendNotification(title: string, body: string, data?: any) {
  if (Platform.OS === 'web') {
    console.log('Push notifications not supported on web');
    return;
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: null,
  });
}

// Send bid notification
export async function sendBidNotification(auctionId: string, auctionTitle: string, bidAmount: number, bidderName?: string) {
  if (Platform.OS === 'web') {
    console.log('Push notifications not supported on web');
    return;
  }
  await sendNotification(
    'New Bid Placed!',
    `A new bid of $${bidAmount.toFixed(2)} was placed on ${auctionTitle}`,
    { auctionId, type: 'new_bid' }
  );
}

// Send outbid notification
export async function sendOutbidNotification(auctionId: string, auctionTitle: string, newBidAmount: number) {
  if (Platform.OS === 'web') {
    console.log('Push notifications not supported on web');
    return;
  }
  await sendNotification(
    'You\'ve Been Outbid!',
    `Someone placed a higher bid of $${newBidAmount.toFixed(2)} on ${auctionTitle}`,
    { auctionId, type: 'outbid' }
  );
}

// Send auction ended notification
export async function sendAuctionEndedNotification(auctionId: string, auctionTitle: string, won: boolean, finalPrice?: number) {
  if (Platform.OS === 'web') {
    console.log('Push notifications not supported on web');
    return;
  }
  const title = won ? 'Congratulations! You Won!' : 'Auction Ended';
  const body = won
    ? `You won ${auctionTitle} for $${finalPrice?.toFixed(2)}`
    : `${auctionTitle} has ended. Better luck next time!`;

  await sendNotification(title, body, { auctionId, type: 'auction_ended', won });
}

// Cancel scheduled notifications for an auction
export async function cancelAuctionNotifications(auctionId: string) {
  if (Platform.OS === 'web') {
    console.log('Push notifications not supported on web');
    return;
  }
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();

  for (const notification of scheduledNotifications) {
    if (notification.content.data?.auctionId === auctionId) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
}

// Initialize notification listeners
export function setupNotificationListeners() {
  if (Platform.OS === 'web') {
    console.log('[notificationService] Push notifications not supported on web');
    return () => {};
  }

  console.log('[notificationService] Setting up notification listeners...');

  // Handle incoming push notifications from Expo
  const pushTokenListener = Notifications.addPushTokenListener((token) => {
    console.log('[notificationService] Push token received:', token);
    console.log('[notificationService] Push token data:', JSON.stringify(token, null, 2));
    // Token is automatically registered by pushTokenService
  });

  // Handle notification received while app is foregrounded
  const notificationListener = Notifications.addNotificationReceivedListener(notification => {
    console.log('[notificationService] Notification received while app is foregrounded:', notification);
    console.log('[notificationService] Notification details:', JSON.stringify(notification, null, 2));
  });

  // Handle notification response (when user taps on notification)
  const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('[notificationService] Notification response (user tapped):', response);
    console.log('[notificationService] Response details:', JSON.stringify(response, null, 2));
    const data = response.notification.request.content.data;

    // Handle navigation based on notification type
    if (data?.auctionId) {
      // Navigate to auction details - this would need to be handled by navigation context
      console.log('[notificationService] Navigate to auction:', data.auctionId);
    }
  });

  console.log('[notificationService] Notification listeners set up successfully');

  return () => {
    console.log('[notificationService] Cleaning up notification listeners...');
    pushTokenListener.remove();
    notificationListener.remove();
    responseListener.remove();
  };
}
