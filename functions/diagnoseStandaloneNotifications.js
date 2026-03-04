/**
 * Diagnostic script for standalone app push notification issue.
 *
 * Usage:
 *   node functions/diagnoseStandaloneNotifications.js --userId YOUR_USER_ID
 *   node functions/diagnoseStandaloneNotifications.js --userId YOUR_USER_ID --sendTest
 *
 * This script:
 *  1. Lists all registered devices for the user with full token details
 *  2. Identifies which device is the standalone vs Expo Go (by registration date)
 *  3. Optionally sends a direct test push to each token and reports the Expo response
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────────────────────
const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, 'serviceAccountKey.json');
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseArgs() {
  const args = { userId: null, sendTest: false };
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--userId') args.userId = process.argv[i + 1];
    if (process.argv[i] === '--sendTest') args.sendTest = true;
  }
  return args;
}

function formatTimestamp(ts) {
  if (!ts) return '(no timestamp)';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}

async function sendDirectExpoPush(tokens, title, body) {
  const messages = tokens.map((to) => ({
    to,
    sound: 'default',
    title,
    body,
    priority: 'high',
    data: { type: 'diagnostic_test' },
  }));

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });

  return res.json();
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();

  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('❌  Service account key not found at:', SERVICE_ACCOUNT_PATH);
    process.exit(1);
  }

  if (!args.userId) {
    console.error('❌  --userId is required. Example:');
    console.error('   node functions/diagnoseStandaloneNotifications.js --userId QEm0DSIzylNQIHpQAZlgtWQkYYE3');
    process.exit(1);
  }

  admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)) });
  const db = admin.firestore();

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(' STANDALONE PUSH NOTIFICATION DIAGNOSTICS');
  console.log('════════════════════════════════════════════════════════════');
  console.log(' User ID :', args.userId);
  console.log('════════════════════════════════════════════════════════════\n');

  // ── 1. Fetch all devices ──────────────────────────────────────────────────
  const devicesSnap = await db
    .collection('users')
    .doc(args.userId)
    .collection('devices')
    .get();

  if (devicesSnap.empty) {
    console.log('⚠️  No devices registered for this user.');
    process.exit(0);
  }

  console.log(`Found ${devicesSnap.size} registered device(s):\n`);

  const validTokens = [];

  devicesSnap.forEach((doc) => {
    const d = doc.data();
    const hasToken = !!d.expoPushToken;
    const tokenValid =
      hasToken && typeof d.expoPushToken === 'string' && d.expoPushToken.startsWith('ExponentPushToken[');

    console.log(`┌─ Device ID: ${doc.id}`);
    console.log(`│  Platform        : ${d.platform ?? '(unknown)'}`);
    console.log(`│  Model           : ${d.modelName ?? '(unknown)'}`);
    console.log(`│  Is Real Device  : ${d.isDevice}`);
    console.log(`│  Permission      : ${d.permStatus ?? '(unknown)'}`);
    console.log(`│  Created At      : ${formatTimestamp(d.createdAt)}`);
    console.log(`│  Updated At      : ${formatTimestamp(d.updatedAt)}`);
    console.log(`│  Token Fetched   : ${formatTimestamp(d.tokenFetchedAt)}`);
    console.log(`│  Project ID      : ${d.projectId ?? '(none)'}`);
    console.log(`│  Expo Token      : ${d.expoPushToken ?? '⛔ NULL – token was not registered!'}`);
    console.log(`│  Token Format OK : ${tokenValid ? '✅ YES (ExponentPushToken[...])' : hasToken ? '⚠️  Token exists but wrong format' : '❌ NO TOKEN'}`);
    console.log(`│  Token Error     : ${d.tokenError ?? 'none'}`);
    console.log(`│  Device Token    : ${d.devicePushToken ?? '(none)'}`);
    console.log(`└─────────────────────────────────────────────────`);
    console.log();

    if (tokenValid) validTokens.push(d.expoPushToken);
  });

  // ── 2. Token analysis ────────────────────────────────────────────────────
  console.log('════════════════════════════════════════════════════════════');
  console.log(' ANALYSIS');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`Valid Expo tokens found  : ${validTokens.length}`);

  if (validTokens.length === 0) {
    console.log('\n❌  ROOT CAUSE: The standalone app device does NOT have a valid');
    console.log('   ExponentPushToken stored in Firestore.');
    console.log('\n   Most likely reason: The APNs Auth Key (P8) is NOT uploaded to');
    console.log('   Expo\'s servers for this project.');
    console.log('\n   FIX:');
    console.log('   1. Run:  eas credentials  (in the mobile project root)');
    console.log('   2. Choose: iOS → your bundle id → Push Notifications (APNs)');
    console.log('   3. Upload your P8 key file from Apple Developer portal');
    console.log('   4. Rebuild the app with: eas build --platform ios --profile production');
    console.log('\n   If you see a tokenError above, that is the exact error from getExpoPushTokenAsync.');
  } else {
    console.log(`\n✅  Tokens look valid in Firestore. The issue is likely at`);
    console.log(`   DELIVERY time (Expo → APNs → device).`);
  }

  // ── 3. Optional: send a direct test push ─────────────────────────────────
  if (args.sendTest && validTokens.length > 0) {
    console.log('\n════════════════════════════════════════════════════════════');
    console.log(' SENDING DIRECT TEST PUSH TO ALL VALID TOKENS');
    console.log('════════════════════════════════════════════════════════════');

    const result = await sendDirectExpoPush(
      validTokens,
      '🔧 Diagnostic Test',
      'If you see this on the standalone app, notifications work!'
    );

    console.log('\nExpo push API response:');
    const tickets = result?.data ?? [];
    tickets.forEach((ticket, i) => {
      const token = validTokens[i];
      if (ticket.status === 'ok') {
        console.log(`  ✅  [${token.substring(0, 30)}...] → ticket id: ${ticket.id}`);
      } else {
        console.log(`  ❌  [${token.substring(0, 30)}...] → ERROR: ${ticket.message}`);
        console.log(`       error code : ${ticket.details?.error}`);
        console.log(`       fault       : ${ticket.details?.fault}`);
        if (ticket.details?.error === 'InvalidCredentials') {
          console.log('\n  🔑  CAUSE: APNs Auth Key is NOT configured in Expo for this project!');
          console.log('       Run: eas credentials → iOS → Push Notifications (APNs) → Upload P8 key');
        }
        if (ticket.details?.error === 'DeviceNotRegistered') {
          console.log('\n  📵  CAUSE: Device token is stale/invalid. The token should be removed from Firestore.');
        }
      }
    });
  } else if (args.sendTest && validTokens.length === 0) {
    console.log('\n⚠️  --sendTest skipped because no valid tokens were found.');
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(' NEXT STEPS CHECKLIST');
  console.log('════════════════════════════════════════════════════════════');
  console.log(' 1. Check above if the standalone device has a valid expoPushToken.');
  console.log('    → If NULL: APNs key not uploaded to Expo. Run: eas credentials');
  console.log(' 2. Run with --sendTest to see the actual Expo delivery response:');
  console.log(`    node functions/diagnoseStandaloneNotifications.js --userId ${args.userId} --sendTest`);
  console.log(' 3. Check Cloud Function logs in Firebase Console for "InvalidCredentials"');
  console.log('    errors when notifications are triggered.');
  console.log(' 4. Go to expo.dev → Project → Credentials → iOS → Verify APNs key is present.');
  console.log('════════════════════════════════════════════════════════════\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
