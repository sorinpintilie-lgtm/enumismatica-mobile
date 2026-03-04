/**
 * Test push notification by sending DIRECTLY to APNs (bypassing Expo push service).
 * APNs requires HTTP/2 — uses Node's built-in http2 module.
 *
 * Usage:
 *   node functions/testDirectAPNs.js \
 *     --p8 ../AuthKey_Q6B33KYXY3.p8 \
 *     --keyId Q6B33KYXY3 \
 *     --teamId B8NGYUSFS2 \
 *     --bundleId ro.recordtrust.enumismatica \
 *     --deviceToken 8151bbcb4a7d169ccac0992f331e9ce8ed7f2483eaee2d3ae958e3362c1d89cc
 */

const fs = require('fs');
const path = require('path');
const http2 = require('http2');
const crypto = require('crypto');

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    args[process.argv[i].replace('--', '')] = process.argv[i + 1];
  }
  return args;
}

/**
 * Create an APNs JWT token using the P8 key.
 * APNs uses ES256 JWT auth.
 */
function createJWT(teamId, keyId, p8Content) {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: teamId,
    iat: Math.floor(Date.now() / 1000),
  })).toString('base64url');

  const signingInput = `${header}.${payload}`;

  // Sign with ES256 using the P8 private key
  const sign = crypto.createSign('SHA256');
  sign.update(signingInput);
  const signature = sign.sign({ key: p8Content, dsaEncoding: 'ieee-p1363' }).toString('base64url');

  return `${signingInput}.${signature}`;
}

/**
 * Send a push notification directly to APNs using HTTP/2.
 */
function sendDirectAPNs(opts) {
  return new Promise((resolve, reject) => {
    const { jwt, deviceToken, bundleId, title, body } = opts;

    const payload = JSON.stringify({
      aps: {
        alert: { title, body },
        sound: 'default',
      },
    });

    const apnsHost = opts.sandbox ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
    const client = http2.connect(apnsHost);
    client.on('error', reject);

    const reqHeaders = {
      [http2.constants.HTTP2_HEADER_METHOD]: 'POST',
      [http2.constants.HTTP2_HEADER_PATH]: `/3/device/${deviceToken}`,
      'authorization': `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload),
    };

    const req = client.request(reqHeaders);
    let statusCode;
    let headers = {};
    let data = '';

    req.on('response', (hdrs) => {
      statusCode = hdrs[http2.constants.HTTP2_HEADER_STATUS];
      headers = hdrs;
    });

    req.on('data', chunk => { data += chunk; });

    req.on('end', () => {
      client.close();
      resolve({ statusCode, headers, body: data });
    });

    req.on('error', (err) => {
      client.close();
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

async function main() {
  const args = parseArgs();

  const p8Path = path.resolve(process.cwd(), args.p8 || '../AuthKey_Q6B33KYXY3.p8');
  const keyId = args.keyId || 'Q6B33KYXY3';
  const teamId = args.teamId || 'B8NGYUSFS2';
  const bundleId = args.bundleId || 'ro.recordtrust.enumismatica';
  const deviceToken = args.deviceToken;
  const title = args.title || '🔬 Direct APNs Test';
  const body = args.body || 'If you see this, direct APNs delivery works!';

  if (!deviceToken) {
    console.error('❌  --deviceToken is required');
    process.exit(1);
  }

  if (!fs.existsSync(p8Path)) {
    console.error(`❌  P8 key not found at: ${p8Path}`);
    process.exit(1);
  }

  const p8Content = fs.readFileSync(p8Path, 'utf8');

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(' DIRECT APNs PUSH TEST (bypassing Expo push service)');
  console.log('════════════════════════════════════════════════════════════');
  console.log(' Key ID       :', keyId);
  console.log(' Team ID      :', teamId);
  console.log(' Bundle ID    :', bundleId);
  console.log(' Device Token :', deviceToken.substring(0, 16) + '...');
  console.log(' APNs Host    :', args.sandbox ? 'api.sandbox.push.apple.com (SANDBOX/development)' : 'api.push.apple.com (PRODUCTION)');
  console.log('════════════════════════════════════════════════════════════\n');

  const jwt = createJWT(teamId, keyId, p8Content);

  console.log('Sending notification...');
  const result = await sendDirectAPNs({ jwt, deviceToken, bundleId, title, body, sandbox: args.sandbox === 'true' });

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(' APNs Response:');
  console.log('════════════════════════════════════════════════════════════');
  console.log(' Status Code :', result.statusCode);
  console.log(' apns-id     :', result.headers['apns-id'] ?? '(none)');
  console.log(' Body        :', result.body || '(empty = success)');

  if (result.statusCode === 200) {
    console.log('\n  ✅  SUCCESS — APNs accepted the notification!');
    console.log('   If you received it on your phone, the setup is CORRECT');
    console.log('   and the issue is in Expo\'s cached push token environment.');
  } else {
    console.log(`\n  ❌  FAILED with status ${result.statusCode}`);
    const errorBody = result.body ? JSON.parse(result.body) : {};
    console.log('  Reason:', errorBody.reason ?? '(unknown)');
    if (errorBody.reason === 'BadDeviceToken') {
      console.log('  → The device token is invalid or stale (no longer registered)');
    }
    if (errorBody.reason === 'BadCertificate' || errorBody.reason === 'InvalidProviderToken') {
      console.log('  → The APNs auth key is invalid or wrong team ID');
    }
    if (errorBody.reason === 'BadEnvironment') {
      console.log('  → The device token is for development but you sent to production APNs endpoint');
      console.log('  → This means the binary still has aps-environment: development entitlements');
    }
  }

  console.log('════════════════════════════════════════════════════════════\n');
  process.exit(result.statusCode === 200 ? 0 : 1);
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
