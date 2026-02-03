
const admin = require('firebase-admin');
const serviceAccount = require('../e-numismatica-ro-firebase-adminsdk-fbsvc-ba41e55b6f.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://enumismatica-573d3.firebaseio.com'
});

const db = admin.firestore();

async function testNotificationForUser(userId) {
  try {
    console.log(`Testing notifications for user: ${userId}`);

    // Create a test notification
    const notificationsRef = db.collection('users').doc(userId).collection('notifications');
    const testNotificationRef = await notificationsRef.add({
      type: 'new_message',
      senderName: 'Test Sender',
      message: 'This is a test notification to check for duplicates',
      pushed: false,
      read: false,
      status: 'pending',
      attempts: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`Created test notification: ${testNotificationRef.id}`);

    // Simulate what sendNotificationPush does
    const notificationDoc = await testNotificationRef.get();
    const notificationData = notificationDoc.data();

    console.log('Testing notification sending logic...');

    // Fetch user devices
    const devicesSnap = await db.collection('users').doc(userId).collection('devices').get();
    console.log(`Found ${devicesSnap.size} device(s)`);

    // Extract unique tokens
    const uniqueTokens = new Set();
    devicesSnap.forEach(doc => {
      const device = doc.data();
      if (device.expoPushToken && device.expoPushToken.startsWith('ExponentPushToken[')) {
        uniqueTokens.add(device.expoPushToken);
        console.log(`Device: ${doc.id}, Token: ${device.expoPushToken}`);
      }
    });

    console.log(`Unique tokens to send to: ${uniqueTokens.size}`);

    // Mark notification as sent
    await testNotificationRef.update({
      pushed: true,
      status: 'sent',
      sentAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('Test completed successfully');

  } catch (error) {
    console.error('Error testing notifications:', error);
  } finally {
    await admin.app().delete();
  }
}

// Use user with 2 devices for testing
testNotificationForUser('fwNtmNwO2ddXPnJocjvJxF9OutC3');
