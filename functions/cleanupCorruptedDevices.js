/**
 * Cleanup script: removes corrupted device documents where the device ID
 * accidentally contains the push token (old registration bug).
 * 
 * Usage: node functions/cleanupCorruptedDevices.js [--dry-run]
 * 
 * With --dry-run: only shows what would be deleted, does not delete.
 * Without --dry-run: actually deletes the corrupted documents.
 */
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const isDryRun = process.argv.includes('--dry-run');

async function cleanupCorruptedDevices() {
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE (will delete)'}\n`);
  
  // Get all users
  const usersSnap = await db.collection('users').get();
  console.log(`Scanning ${usersSnap.size} users...\n`);
  
  let totalCorrupted = 0;
  let totalDeleted = 0;
  
  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const devicesSnap = await db.collection('users').doc(userId).collection('devices').get();
    
    for (const deviceDoc of devicesSnap.docs) {
      const deviceId = deviceDoc.id;
      
      // Corrupted device IDs contain "ExponentPushToken" in the document ID
      if (deviceId.includes('ExponentPushToken')) {
        totalCorrupted++;
        const d = deviceDoc.data();
        console.log(`CORRUPTED: users/${userId}/devices/${deviceId}`);
        console.log(`  token: ${d.expoPushToken || '(none)'}`);
        console.log(`  platform: ${d.platform}`);
        
        if (!isDryRun) {
          await deviceDoc.ref.delete();
          totalDeleted++;
          console.log(`  -> DELETED`);
        } else {
          console.log(`  -> Would delete (dry run)`);
        }
        console.log('');
      }
    }
  }
  
  console.log(`\nSummary:`);
  console.log(`  Corrupted devices found: ${totalCorrupted}`);
  if (!isDryRun) {
    console.log(`  Deleted: ${totalDeleted}`);
  }
}

cleanupCorruptedDevices()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
