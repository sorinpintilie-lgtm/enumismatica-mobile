/**
 * Test sending a push notification to the new token for user QEm0DSIzylNQIHpQAZlgtWQkYYE3
 * This creates a notification document which triggers the Cloud Function
 */
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function sendTestNotification(userId) {
  console.log(`Sending test notification to user: ${userId}`);
  
  // First show current device state
  const devicesSnap = await db.collection('users').doc(userId).collection('devices').get();
  console.log(`\nCurrent devices (${devicesSnap.size}):`);
  devicesSnap.forEach(doc => {
    const d = doc.data();
    console.log(`  ${doc.id}: token=${d.expoPushToken || '(none)'}, permStatus=${d.permStatus}`);
  });
  
  // Create a test notification - this triggers the Cloud Function
  const notifRef = await db.collection('users').doc(userId).collection('notifications').add({
    type: 'new_message',
    senderName: 'Test',
    message: 'Test notification - verifying new token works',
    pushed: false,
    read: false,
    status: 'pending',
    attempts: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  console.log(`\nCreated notification: ${notifRef.id}`);
  console.log('Cloud Function should trigger within a few seconds.');
  console.log('Check Cloud Run logs for the result.');
  
  // Wait 5 seconds then check if it was sent
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const notifDoc = await notifRef.get();
  const notifData = notifDoc.data();
  console.log(`\nNotification status after 5s: ${notifData?.status}`);
  console.log(`pushed: ${notifData?.pushed}`);
  
  process.exit(0);
}

sendTestNotification('QEm0DSIzylNQIHpQAZlgtWQkYYE3')
  .catch(err => { console.error(err); process.exit(1); });
