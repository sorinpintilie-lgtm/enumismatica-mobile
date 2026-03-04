/**
 * Send a test push to the NEW production ExponentPushToken and check the receipt.
 */
const admin = require('firebase-admin');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, 'serviceAccountKey.json');
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

const NEW_PRODUCTION_TOKEN = 'ExponentPushToken[-kc_pTOx62K_BXsHJ6-ipH]';
const USER_ID = 'QEm0DSIzylNQIHpQAZlgtWQkYYE3';
const NATIVE_TOKEN = 'e73c9857c4a7f8ed6937b9cc69b5a17f0866dcce49fbafacd175d57e3a200cb7';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  // Update Firestore with new production token
  admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)) });
  const db = admin.firestore();

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(' TESTING NEW PRODUCTION EXPO PUSH TOKEN');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(' New token (production):', NEW_PRODUCTION_TOKEN);
  console.log(' Native APNs token    :', NATIVE_TOKEN.substring(0, 20) + '...');
  console.log('');

  // Step 1: Update the Firestore device document with the new production token
  const deviceRef = db.collection('users').doc(USER_ID).collection('devices').doc('ios-38AB7AE2-467B-4403-830D-03FC8046A78D');
  await deviceRef.update({
    expoPushToken: NEW_PRODUCTION_TOKEN,
    devicePushToken: NATIVE_TOKEN,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('✅  Updated Firestore device document with new production token.');

  // Step 2: Send a test push to the new token
  console.log('\nSending test push to new production token...');
  const pushRes = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify([{
      to: NEW_PRODUCTION_TOKEN,
      title: '🎉 Production Push! Finally Working!',
      body: 'If you see this on the standalone app, notifications are FIXED!',
      sound: 'default',
      priority: 'high',
      data: { type: 'final_verification_test' },
    }]),
  });
  const pushData = await pushRes.json();
  const ticket = pushData?.data?.[0];
  console.log('Ticket:', JSON.stringify(ticket));

  if (!ticket?.id || ticket.status !== 'ok') {
    console.log('\n❌  Push ticket failed:', ticket?.message);
    process.exit(1);
  }

  console.log('\n✅  Push ticket accepted! Ticket ID:', ticket.id);
  console.log('\nWaiting 45 seconds for APNs to process...');
  await sleep(45000);

  // Step 3: Check receipt
  console.log('Checking receipt...');
  const receiptRes = await fetch(EXPO_RECEIPTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ids: [ticket.id] }),
  });
  const receiptData = await receiptRes.json();
  const receipt = receiptData?.data?.[ticket.id];

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(' PUSH RECEIPT RESULT:');
  console.log('══════════════════════════════════════════════════════════════');
  if (!receipt) {
    console.log('  ⏳  Receipt not ready yet (try again in ~30 seconds)');
  } else if (receipt.status === 'ok') {
    console.log('  ✅  SUCCESS! APNs accepted the push notification!');
    console.log('  → Did you receive the notification on your iPhone? 📱');
    console.log('  → If yes, standalone app push notifications are now FIXED!');
  } else {
    console.log('  ❌  ERROR:', receipt.message);
    console.log('  reason   :', receipt.details?.error);
    console.log('  The issue persists. Additional investigation needed.');
  }
  console.log('══════════════════════════════════════════════════════════════\n');

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
