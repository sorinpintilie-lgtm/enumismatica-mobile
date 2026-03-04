/**
 * Cleans up stale device documents that have been superseded by newer registrations.
 * Run this after confirming the new device registration is working.
 *
 * Usage:
 *   node functions/cleanupStaleDevices.js --userId YOUR_USER_ID --keepLatest
 *   node functions/cleanupStaleDevices.js --userId YOUR_USER_ID --deleteDevice DEVICE_ID
 */
const admin = require('firebase-admin');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, 'serviceAccountKey.json');

function parseArgs() {
  const args = { userId: null, keepLatest: false, deleteDevice: null };
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--userId') args.userId = process.argv[i + 1];
    if (process.argv[i] === '--keepLatest') args.keepLatest = true;
    if (process.argv[i] === '--deleteDevice') args.deleteDevice = process.argv[i + 1];
  }
  return args;
}

function formatTimestamp(ts) {
  if (!ts) return '(no timestamp)';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}

async function main() {
  const args = parseArgs();
  if (!args.userId) {
    console.error('❌  --userId is required');
    process.exit(1);
  }

  admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)) });
  const db = admin.firestore();

  console.log(`\nUser: ${args.userId}`);
  const devicesSnap = await db.collection('users').doc(args.userId).collection('devices').get();

  console.log(`\nFound ${devicesSnap.size} device(s):\n`);
  const docs = [];
  devicesSnap.forEach(doc => {
    const d = doc.data();
    docs.push({ id: doc.id, ref: doc.ref, data: d, createdAt: d.createdAt });
    console.log(`  ${doc.id} — created: ${formatTimestamp(d.createdAt)} — token: ${d.expoPushToken ?? 'null'}`);
  });

  if (args.deleteDevice) {
    const target = docs.find(d => d.id === args.deleteDevice);
    if (!target) {
      console.error(`\n❌  Device ${args.deleteDevice} not found.`);
      process.exit(1);
    }
    await target.ref.delete();
    console.log(`\n✅  Deleted device: ${args.deleteDevice}`);
    process.exit(0);
  }

  if (args.keepLatest) {
    // Sort by creation time, keep the latest, delete the rest
    const sorted = [...docs].sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });

    const toKeep = sorted[0];
    const toDelete = sorted.slice(1).filter(d => d.id !== toKeep.id);

    console.log(`\nKeeping latest: ${toKeep.id} (${formatTimestamp(toKeep.createdAt)})`);
    if (toDelete.length === 0) {
      console.log('Nothing to delete.');
    } else {
      for (const d of toDelete) {
        await d.ref.delete();
        console.log(`  Deleted: ${d.id} (${formatTimestamp(d.createdAt)})`);
      }
      console.log(`\n✅  Cleaned up ${toDelete.length} stale device(s).`);
    }
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
