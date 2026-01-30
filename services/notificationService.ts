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

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      description: 'Notificări implicite pentru eNumismatica',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#e7b73c',
      sound: 'default',
      enableVibrate: true,
      showBadge: false,
    }).then(() => {
      console.log('[notificationService] Android notification channel created successfully');
    }).catch((error) => {
      console.error('[notificationService] Failed to create Android notification channel:', error);
    });
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

    if (status !== 'granted') {
      console.log('[notificationService] Requesting Android notification permissions...');
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      console.log('[notificationService] Android new permission status:', newStatus);

      if (newStatus !== 'granted') {
        console.log('[notificationService] Failed to get push token for push notification!');
        return false;
      }
    }
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
    console.log('Push notifications not supported on web');
    return '';
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
    ?? Constants.easConfig?.projectId;

  console.log('[notificationService] Getting push token for platform:', Platform.OS);
  console.log('[notificationService] Project ID:', projectId);

  if (!projectId) {
    console.error('[notificationService] No project ID found in app config');
    return '';
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    console.log('[notificationService] Push token retrieved:', token.data ? `${token.data.substring(0, 20)}...` : 'null');
    return token.data;
  } catch (error) {
    console.error('[notificationService] Error getting push token:', error);
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
    console.log('Push notifications not supported on web');
    return () => {};
  }

  // Handle incoming push notifications from Expo
  const pushTokenListener = Notifications.addPushTokenListener((token) => {
    console.log('Push token received:', token);
    // Token is automatically registered by pushTokenService
  });

  // Handle notification received while app is foregrounded
  const notificationListener = Notifications.addNotificationReceivedListener(notification => {
    console.log('Notification received:', notification);
  });

  // Handle notification response (when user taps on notification)
  const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('Notification response:', response);
    const data = response.notification.request.content.data;

    // Handle navigation based on notification type
    if (data?.auctionId) {
      // Navigate to auction details - this would need to be handled by navigation context
      console.log('Navigate to auction:', data.auctionId);
    }
  });

  return () => {
    pushTokenListener.remove();
    notificationListener.remove();
    responseListener.remove();
  };
}
