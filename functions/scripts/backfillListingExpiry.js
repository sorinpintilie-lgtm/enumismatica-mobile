/*
 * One-time migration script:
 * Set listingExpiresAt for already-live direct products that don't have it.
 *
 * Usage (from functions/):
 *   node ./scripts/backfillListingExpiry.js --dry-run
 *   node ./scripts/backfillListingExpiry.js --apply
 *
 * Optional:
 *   --rollout=2026-02-12T00:00:00Z
 *   --days=30
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function parseArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  if (!found) return fallback;
  return found.slice(prefix.length);
}

function hasFlag(flag) {
  return process.argv.includes(`--${flag}`);
}

const DRY_RUN = hasFlag('dry-run');
const APPLY = hasFlag('apply');

if (!DRY_RUN && !APPLY) {
  console.error('Missing mode. Use --dry-run or --apply');
  process.exit(1);
}

if (DRY_RUN && APPLY) {
  console.error('Use only one mode: --dry-run or --apply');
  process.exit(1);
}

const PROJECT_ID = 'e-numismatica-ro';
const ROLLOUT_ISO = parseArg('rollout', '2026-02-12T00:00:00Z');
const WINDOW_DAYS = Number(parseArg('days', '30'));
const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../serviceAccountKey.json');

if (!Number.isFinite(WINDOW_DAYS) || WINDOW_DAYS <= 0) {
  console.error('Invalid --days value. Must be a positive number.');
  process.exit(1);
}

const rolloutDate = new Date(ROLLOUT_ISO);
if (Number.isNaN(rolloutDate.getTime())) {
  console.error('Invalid --rollout date. Example: --rollout=2026-02-12T00:00:00Z');
  process.exit(1);
}

const targetExpiry = new Date(rolloutDate);
targetExpiry.setDate(targetExpiry.getDate() + WINDOW_DAYS);

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`Service account file not found: ${SERVICE_ACCOUNT_PATH}`);
  console.error('Place your key at functions/serviceAccountKey.json');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function run() {
  console.log('--- Backfill listingExpiresAt migration ---');
  console.log('Mode:', DRY_RUN ? 'DRY-RUN' : 'APPLY');
  console.log('Project:', PROJECT_ID || '(default credentials project)');
  console.log('Rollout:', rolloutDate.toISOString());
  console.log('Target expiry:', targetExpiry.toISOString());

  const snapshot = await db
    .collection('products')
    .where('status', '==', 'approved')
    .where('listingType', '==', 'direct')
    .get();

  const approvedDirectTotal = snapshot.size;

  const eligible = [];
  const toUpdate = [];
  snapshot.forEach((doc) => {
    const data = doc.data() || {};

    // Treat missing isSold as NOT sold (legacy docs often omit this field).
    const sold = data.isSold === true;
    if (sold) return;

    const hasExpiry = !!data.listingExpiresAt;
    eligible.push({
      id: doc.id,
      ownerId: data.ownerId || null,
      name: data.name || null,
      hasExpiry,
      isSold: data.isSold,
    });

    if (!hasExpiry) {
      toUpdate.push(doc.ref);
    }
  });

  console.log('Approved+direct docs total:', approvedDirectTotal);
  console.log('Eligible approved+direct+unsold docs:', eligible.length);

  console.log('Missing listingExpiresAt:', toUpdate.length);

  if (DRY_RUN) {
    console.log('--- Eligible documents (all) ---');
    eligible.forEach((item) => {
      console.log(`- ${item.id} | owner=${item.ownerId || 'n/a'} | hasExpiry=${item.hasExpiry} | name=${item.name || 'n/a'}`);
    });

    if (toUpdate.length > 0) {
      console.log('--- Documents that WILL be updated ---');
      toUpdate.forEach((ref) => console.log('-', ref.id));
    }

    console.log('Dry run complete. No writes were performed.');
    return;
  }

  if (toUpdate.length === 0) {
    console.log('Nothing to update.');
    return;
  }

  const CHUNK_SIZE = 400;
  let updated = 0;

  for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
    const chunk = toUpdate.slice(i, i + CHUNK_SIZE);
    const batch = db.batch();

    chunk.forEach((ref) => {
      batch.update(ref, {
        listingExpiresAt: admin.firestore.Timestamp.fromDate(targetExpiry),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    updated += chunk.length;
    console.log(`Committed batch: ${updated}/${toUpdate.length}`);
  }

  console.log('Migration complete. Updated docs:', updated);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
