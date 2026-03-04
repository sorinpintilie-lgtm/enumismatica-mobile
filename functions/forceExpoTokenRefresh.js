/**
 * Force Expo's push service to re-register a device token with development=false.
 * This fixes the case where Expo's internal delivery path was set to
 * development/sandbox mode for a token that's now from a production binary.
 *
 * Usage:
 *   node functions/forceExpoTokenRefresh.js \
 *     --nativeToken e73c9857c4a7f8ed6937b9cc69b5a17f0866dcce49fbafacd175d57e3a200cb7 \
 *     --projectId f4fa174b-8702-4031-b9b3-e72887532885
 */
const https = require('https');

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    args[process.argv[i].replace('--', '')] = process.argv[i + 1];
  }
  return args;
}

/** Call Expo's getExpoPushToken endpoint directly with explicit development=false */
function registerWithExpo(nativeToken, projectId, development) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      type: 'apns',
      development: development,
      deviceToken: nativeToken,
      appId: 'ro.recordtrust.enumismatica',
      projectId: projectId,
      deviceId: '38AB7AE2-467B-4403-830D-03FC8046A78D', // iOS vendor ID (IDFV) from Firestore
    });

    const options = {
      hostname: 'exp.host',
      port: 443,
      path: '/--/api/v2/push/getExpoPushToken',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const args = parseArgs();

  const nativeToken = args.nativeToken;
  const projectId = args.projectId || 'f4fa174b-8702-4031-b9b3-e72887532885';

  if (!nativeToken) {
    console.error('❌ --nativeToken is required');
    process.exit(1);
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(' FORCE EXPO TOKEN REGISTRATION (development=false)');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(' Native Token :', nativeToken.substring(0, 20) + '...');
  console.log(' Project ID   :', projectId);
  console.log('══════════════════════════════════════════════════════════════\n');

  // Try with development=false (production mode)
  console.log('Registering with Expo (development=false → production mode)...');
  const prodResult = await registerWithExpo(nativeToken, projectId, false);
  console.log(' Status:', prodResult.statusCode);
  console.log(' Body  :', prodResult.body);

  try {
    const parsed = JSON.parse(prodResult.body);
    if (parsed?.data?.expoPushToken) {
      console.log('\n ✅ Expo push token (production mode):', parsed.data.expoPushToken);
      console.log('    → This ExponentPushToken is now registered as PRODUCTION.');
      console.log('    → Next push to this token should use production APNs endpoint.');
    } else if (parsed?.errors) {
      console.log('\n ❌ Error:', JSON.stringify(parsed.errors));
    }
  } catch (e) {
    console.log(' (Could not parse response as JSON)');
  }

  console.log('\n══════════════════════════════════════════════════════════════\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
