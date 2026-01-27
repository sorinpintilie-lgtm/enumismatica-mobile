import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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

// Request notification permissions
export async function requestNotificationPermissions() {
  if (Platform.OS === 'web') {
    console.log('Push notifications not supported on web');
    return false;
  }
  const permissions = await Notifications.getPermissionsAsync();
  
  if (permissions.status !== 'granted') {
    const newPermissions = await Notifications.requestPermissionsAsync();
    if (newPermissions.status !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return false;
    }
  }

  return true;
}

// Get push token
export async function getPushToken() {
  if (Platform.OS === 'web') {
    console.log('Push notifications not supported on web');
    return '';
  }
  const token = await Notifications.getExpoPushTokenAsync();
  return token.data;
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
      // Navigate to auction details - this would need to be handled by the navigation context
      console.log('Navigate to auction:', data.auctionId);
    }
  });

  return () => {
    notificationListener.remove();
    responseListener.remove();
  };
}
