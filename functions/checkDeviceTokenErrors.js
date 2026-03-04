/**
 * Diagnostic script: reads all device documents for a user and shows tokenError fields
 * Usage: node functions/checkDeviceTokenErrors.js <userId>
 */
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkDeviceTokenErrors(userId) {
  console.log(`\nChecking device token errors for user: ${userId}\n`);

  const devicesSnap = await db.collection('users').doc(userId).collection('devices').get();
  
  if (devicesSnap.empty) {
    console.log('No devices found for this user.');
    return;
  }

  console.log(`Found ${devicesSnap.size} device(s):\n`);
  
  devicesSnap.forEach(doc => {
    const d = doc.data();
    console.log(`--- Device: ${doc.id} ---`);
    console.log(`  platform:       ${d.platform}`);
    console.log(`  isDevice:       ${d.isDevice}`);
    console.log(`  modelName:      ${d.modelName}`);
    console.log(`  permStatus:     ${d.permStatus}`);
    console.log(`  expoPushToken:  ${d.expoPushToken || '(none)'}`);
    console.log(`  devicePushToken:${d.devicePushToken || '(none)'}`);
    console.log(`  tokenError:     ${d.tokenError || '(none)'}`);
    console.log(`  projectId:      ${d.projectId}`);
    console.log(`  tokenFetchedAt: ${d.tokenFetchedAt?.toDate?.() || d.tokenFetchedAt}`);
    console.log('');
  });
}

const userId = process.argv[2];
if (!userId) {
  console.error('Usage: node checkDeviceTokenErrors.js <userId>');
  process.exit(1);
}

checkDeviceTokenErrors(userId)
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
