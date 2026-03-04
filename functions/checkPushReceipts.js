/**
 * Check Expo push receipts to verify actual APNs delivery.
 *
 * Usage:
 *   node functions/checkPushReceipts.js --ids TICKET_ID1,TICKET_ID2
 *
 * Expo receipts are available ~15s after sending the original push.
 * The receipt tells you if APNs/FCM actually accepted the message.
 *
 * Receipt status values:
 *   ok          – APNs/FCM accepted the message (delivered or queued)
 *   error       – APNs/FCM rejected it (DeviceNotRegistered, InvalidCredentials, etc.)
 */

const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

function parseArgs() {
  const args = { ids: [] };
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--ids' && process.argv[i + 1]) {
      args.ids = process.argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean);
      i++;
    }
  }
  return args;
}

async function checkReceipts(ids) {
  const res = await fetch(EXPO_RECEIPTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ids }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json();
}

async function main() {
  const args = parseArgs();

  if (args.ids.length === 0) {
    console.error('❌ --ids is required. Pass comma-separated Expo ticket IDs.');
    console.error('   Example: node functions/checkPushReceipts.js --ids ID1,ID2');
    process.exit(1);
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(' EXPO PUSH RECEIPTS CHECK');
  console.log('════════════════════════════════════════════════════════════');
  console.log('Checking', args.ids.length, 'receipt(s)...\n');

  const result = await checkReceipts(args.ids);
  const receipts = result?.data ?? {};

  for (const id of args.ids) {
    const receipt = receipts[id];
    if (!receipt) {
      console.log(`  ⏳  ${id} → not ready yet (try again in ~15 seconds)`);
      continue;
    }

    if (receipt.status === 'ok') {
      console.log(`  ✅  ${id} → ok (APNs/FCM accepted delivery)`);
    } else {
      console.log(`  ❌  ${id} → ERROR`);
      console.log(`       message    : ${receipt.message}`);
      console.log(`       error code : ${receipt.details?.error}`);

      if (receipt.details?.error === 'DeviceNotRegistered') {
        console.log('\n  📵  This APNs token is stale/unregistered with Apple.');
        console.log('       The device document should be deleted from Firestore.');
        console.log('       Run: firebase firestore:delete the specific device doc.');
      }

      if (receipt.details?.error === 'InvalidCredentials') {
        console.log('\n  🔑  APNs Auth Key is MISSING from Expo credentials!');
        console.log('       Run: eas credentials → iOS → Push Notifications → Upload P8 key');
      }

      if (receipt.details?.error === 'DeveloperError') {
        console.log('\n  ⚙️   APNs DeveloperError — this error from Apple means one of:');
        console.log('       1. TopicDisallowed: The APNs key in Expo is for a DIFFERENT team');
        console.log('          OR is a development-only key being used against a production build.');
        console.log('       2. The APNs Environment mismatch: app is production but key targets sandbox.');
        console.log('');
        console.log('       IMMEDIATE FIX STEPS:');
        console.log('       Step 1: Run `eas credentials --platform ios` to view current credentials.');
        console.log('       Step 2: Delete the existing APNs key if it shows "Development" or wrong team.');
        console.log('       Step 3: Re-run `eas credentials` → iOS → Push Notifications (APNs)');
        console.log('               → "Add a new APNs Key" → let EAS auto-provision OR upload P8.');
        console.log('       Step 4: Ensure the Apple Developer App ID for ro.recordtrust.enumismatica');
        console.log('               has Push Notifications ENABLED (Certificates, Identifiers & Profiles).');
        console.log('       NOTE:  You do NOT need to rebuild the app — credentials update applies immediately.');
      }
    }
  }

  console.log('\n════════════════════════════════════════════════════════════\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
