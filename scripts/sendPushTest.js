const fs = require('fs');
const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const DEFAULT_SERVICE_ACCOUNT = './e-numismatica-ro-firebase-adminsdk-fbsvc-ba41e55b6f.json';
const EXPO_TOKEN_REGEX = /Expo(nent)?PushToken\[[^\]]+\]/i;

function parseArgs(argv) {
  const args = {
    serviceAccount: DEFAULT_SERVICE_ACCOUNT,
    title: 'Test Push Notification',
    body: 'This is a test push notification sent to all users.',
    data: {},
    dryRun: false,
    limit: 0,
    inApp: true,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '--serviceAccount':
      case '--service-account':
        args.serviceAccount = next;
        i += 1;
        break;
      case '--title':
        args.title = next;
        i += 1;
        break;
      case '--body':
        args.body = next;
        i += 1;
        break;
      case '--data':
        try {
          args.data = next ? JSON.parse(next) : {};
        } catch (err) {
          console.error('Invalid JSON for --data. Example: --data "{\"type\":\"test\"}"');
          process.exit(1);
        }
        i += 1;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--no-in-app':
        args.inApp = false;
        break;
      case '--in-app':
        args.inApp = true;
        break;
      case '--limit':
        args.limit = Number(next || 0);
        i += 1;
        break;
      default:
        break;
    }
  }

  return args;
}

function normalizeTokens(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') return [value];
  return [];
}

function extractTokensFromUser(userData) {
  const candidates = [
    'expoPushToken',
    'expoPushTokens',
    'pushToken',
    'pushTokens',
    'fcmToken',
    'fcmTokens',
    'notificationToken',
    'notificationTokens',
    'deviceToken',
    'deviceTokens',
  ];

  const tokens = [];
  for (const key of candidates) {
    tokens.push(...normalizeTokens(userData[key]));
  }
  return tokens;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function createInAppNotifications(db, userIds, title, body) {
  if (!userIds.length) {
    console.log('No users matched for in-app notification creation.');
    return;
  }

  const batchSize = 400;
  let batch = db.batch();
  let ops = 0;
  let created = 0;

  for (const userId of userIds) {
    const notifRef = db.collection('users').doc(userId).collection('notifications').doc();
    batch.set(notifRef, {
      userId,
      type: 'system',
      title,
      message: body,
      read: false,
      pushed: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    ops += 1;
    created += 1;

    if (ops >= batchSize) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
  }

  console.log(`Created ${created} in-app notifications.`);
}

async function sendExpoPush(tokens, title, body, data) {
  const payload = tokens.map((to) => ({
    to,
    sound: 'default',
    title,
    body,
    data,
  }));

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Expo push API error ${response.status}: ${text}`);
  }

  return response.json();
}

async function main() {
  const args = parseArgs(process.argv);
  const serviceAccountPath = path.resolve(process.cwd(), args.serviceAccount);

  if (!fs.existsSync(serviceAccountPath)) {
    console.error(`Service account JSON not found: ${serviceAccountPath}`);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
    });
  }

  const db = getFirestore();
  const snapshot = await db.collection('users').get();

  const allTokens = [];
  const subcollectionTokens = [];
  const tokenEntries = [];

  for (const userDoc of snapshot.docs) {
    const data = userDoc.data() || {};
    const userTokens = extractTokensFromUser(data);
    allTokens.push(...userTokens);
    userTokens.forEach((token) => tokenEntries.push({ userId: userDoc.id, token }));

    const devicesSnap = await userDoc.ref.collection('devices').get();
    devicesSnap.forEach((deviceDoc) => {
      const deviceData = deviceDoc.data() || {};
      const deviceTokens = extractTokensFromUser(deviceData);
      subcollectionTokens.push(...deviceTokens);
      deviceTokens.forEach((token) => tokenEntries.push({ userId: userDoc.id, token }));
    });
  }

  const expoTokens = Array.from(
    new Set(
      [...allTokens, ...subcollectionTokens].filter((token) => EXPO_TOKEN_REGEX.test(token))
    )
  );

  const limitedTokens = args.limit > 0 ? expoTokens.slice(0, args.limit) : expoTokens;

  console.log(`Users scanned: ${snapshot.size}`);
  console.log(`Total tokens found: ${allTokens.length}`);
  console.log(`Expo tokens matched: ${expoTokens.length}`);
  console.log(`Expo tokens to send: ${limitedTokens.length}`);

  if (limitedTokens.length === 0) {
    console.log('No Expo push tokens found. Ensure users store Expo tokens in Firestore.');
    process.exit(1);
  }

  if (args.dryRun) {
    console.log('Dry run enabled. No notifications sent.');
    process.exit(0);
  }

  const selectedTokenSet = new Set(limitedTokens);
  const targetUserIds = Array.from(
    new Set(tokenEntries.filter((entry) => selectedTokenSet.has(entry.token)).map((entry) => entry.userId))
  );

  const chunks = chunkArray(limitedTokens, 100);
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    console.log(`Sending chunk ${i + 1}/${chunks.length} (${chunk.length} tokens)...`);
    const result = await sendExpoPush(chunk, args.title, args.body, args.data);
    console.log(`Chunk ${i + 1} response:`, JSON.stringify(result));
  }

  if (args.inApp) {
    await createInAppNotifications(db, targetUserIds, args.title, args.body);
  }

  console.log('Push notification test complete.');
}

main().catch((err) => {
  console.error('Push test failed:', err);
  process.exit(1);
});
