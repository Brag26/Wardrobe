// server/scripts/import-fashion-dataset.js
//
// Imports the Kaggle "Fashion Product Images Dataset"
// (https://www.kaggle.com/datasets/paramaggarwal/fashion-product-images-dataset)
// from your local disk into your wardrobe app, using the app's real
// upload flow (presigned S3 URLs) — same path as if you'd added each
// item by hand through the app.
//
// EXPECTED FOLDER STRUCTURE (what you get after unzipping the Kaggle
// download):
//   <DATASET_DIR>/
//     styles.csv
//     images/
//       1163.jpg
//       1164.jpg
//       ...
//
// SETUP:
//   1. npm install csv-parse   (run once, in the server/ folder)
//   2. Edit the CONFIG block below — set DATASET_DIR to wherever you
//      unzipped the dataset, and adjust MAX_ITEMS / GENDER_FILTER as needed
//   3. Make sure your backend is running (npm run dev) with
//      DEV_LOGIN_ENABLED=true
//   4. node scripts/import-fashion-dataset.js
//
// The dataset's CSV columns (as of the current Kaggle version) are:
//   id, gender, masterCategory, subCategory, articleType, baseColour,
//   season, year, usage, productDisplayName
// There is NO brand column in this dataset — imported items will have
// brand left blank. If you want branded data, that's what the earlier
// seed-dress-catalog.js script gives you (illustrative brands, no
// dataset backing it) — the two are complementary, not the same thing.
//
// IMPORTANT ON SIZE: the full dataset is ~23GB of high-resolution
// images. Uploading thousands of multi-MB files will take a long time
// and use real S3 storage. MAX_ITEMS below defaults to a small number
// on purpose — raise it once you've confirmed the import works
// correctly on a small batch first.

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Without a timeout, an unreachable/hanging backend leaves fetch()
// waiting forever with zero feedback — same issue that was hit in the
// app itself. This wraps every network call here with a 15s cutoff so
// a stuck connection fails clearly instead of hanging silently.
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after 15s`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------- CONFIG — edit these ----------
const DATASET_DIR = 'C:\\Users\\Dell\\Downloads\\fashion-dataset'; // <-- CHANGE THIS to your actual unzip location
const API_BASE_URL = 'http://localhost:4000/api';
const PHONE = '+919876543210';
const MAX_ITEMS = 100;             // start small, raise once confirmed working
const GENDER_FILTER = 'Women';     // set to null to import all genders
const DELAY_BETWEEN_UPLOADS_MS = 300; // be gentle on your own dev server
const PROGRESS_FILE = path.join(__dirname, '.import-progress.json');
// ------------------------------------------

// Maps the dataset's articleType to this app's category vocabulary.
// Anything not listed here falls through to a lowercased version of
// articleType itself — remember category is free text in this app
// (no locked list), so an imperfect match still saves fine, just may
// not group neatly with existing items of the "real" category name.
const CATEGORY_MAP = {
  'Dresses': 'dress', 'Tops': 'top', 'Tshirts': 'top', 'Shirts': 'top',
  'Jeans': 'bottom', 'Trousers': 'bottom', 'Shorts': 'bottom', 'Skirts': 'bottom',
  'Heels': 'shoes', 'Flats': 'shoes', 'Sports Shoes': 'shoes', 'Casual Shoes': 'shoes', 'Sandals': 'shoes',
  'Handbags': 'bag', 'Clutches': 'bag', 'Backpacks': 'bag',
  'Watches': 'accessory', 'Necklace and Chains': 'accessory', 'Earrings': 'accessory', 'Bracelet': 'accessory', 'Sunglasses': 'accessory',
  'Jackets': 'outerwear', 'Sweaters': 'outerwear', 'Sweatshirts': 'outerwear',
};

const SEASON_MAP = { Summer: 'summer', Winter: 'winter', Fall: 'autumn', Spring: 'spring' };

const USAGE_TO_OCCASIONS = {
  Casual: ['coffee', 'brunch'],
  Formal: ['office', 'event'],
  Party: ['party'],
  Travel: ['travel'],
  Ethnic: ['event', 'wedding'],
  Sports: [],
  'Smart Casual': ['office', 'coffee'],
};

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    return new Set(JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8')));
  }
  return new Set();
}
function saveProgress(doneIds) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify([...doneIds]));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const csvPath = path.join(DATASET_DIR, 'styles.csv');
  const imagesDir = path.join(DATASET_DIR, 'images');

  if (!fs.existsSync(csvPath)) {
    console.error(`Can't find styles.csv at ${csvPath}`);
    console.error('Check DATASET_DIR at the top of this script matches where you unzipped the dataset.');
    process.exit(1);
  }
  if (!fs.existsSync(imagesDir)) {
    console.error(`Can't find the images/ folder at ${imagesDir}`);
    process.exit(1);
  }

  console.log('Reading styles.csv...');
  const csvText = fs.readFileSync(csvPath, 'utf-8');
  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,             // the dataset has some rows with malformed/unescaped quotes (e.g. "Nike Women's...") — this stops those from hard-crashing the parse
    skip_records_with_error: true,  // any row still too broken to parse is skipped, not fatal to the whole import
  });
  console.log(`Found ${rows.length} total products in the dataset.`);

  let filtered = rows.filter((r) => fs.existsSync(path.join(imagesDir, `${r.id}.jpg`)));
  if (GENDER_FILTER) filtered = filtered.filter((r) => r.gender === GENDER_FILTER);
  console.log(`${filtered.length} match your filters and have an image file present.`);

  const doneIds = loadProgress();
  const toImport = filtered.filter((r) => !doneIds.has(r.id)).slice(0, MAX_ITEMS);
  console.log(`Importing ${toImport.length} items (${doneIds.size} already done in a previous run, skipped).\n`);

  if (toImport.length === 0) {
    console.log('Nothing new to import — raise MAX_ITEMS or delete .import-progress.json to re-run from scratch.');
    return;
  }

  console.log(`Logging in as ${PHONE} via dev-login...`);
  let loginRes;
  try {
    loginRes = await fetchWithTimeout(`${API_BASE_URL}/auth/dev-login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: PHONE }),
    });
  } catch (err) {
    console.error(`\nCould not reach the backend at ${API_BASE_URL}.`);
    console.error(`Underlying error: ${err.cause?.code ?? err.message}`);
    console.error('\nMost likely cause: the backend isn\'t running.');
    console.error('Open a SEPARATE terminal, cd into the server folder, and run: npm run dev');
    console.error('Leave that terminal open and running, THEN run this import script again in a different terminal.\n');
    process.exit(1);
  }
  const loginBody = await loginRes.json();
  if (!loginRes.ok) {
    console.error('Login failed:', loginBody);
    console.error('Make sure DEV_LOGIN_ENABLED=true is set in your .env');
    process.exit(1);
  }
  const token = loginBody.token;
  console.log('Logged in.\n');

  let success = 0, failed = 0;

  for (const row of toImport) {
    try {
      const category = CATEGORY_MAP[row.articleType] ?? row.articleType?.toLowerCase() ?? 'accessory';
      const color = (row.baseColour ?? 'multicolor').toLowerCase();
      const season = SEASON_MAP[row.season] ?? null;
      const occasionTags = USAGE_TO_OCCASIONS[row.usage] ?? [];

      // 1. Get a presigned upload slot
      const uploadRes = await fetchWithTimeout(`${API_BASE_URL}/wardrobe/upload-url`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileExtension: 'jpg' }),
      });
      const { itemId, key, uploadUrl } = await uploadRes.json();

      // 2. Upload the REAL local image file
      const imageBuffer = fs.readFileSync(path.join(imagesDir, `${row.id}.jpg`));
      await fetchWithTimeout(uploadUrl, { method: 'PUT', body: imageBuffer, headers: { 'Content-Type': 'image/jpeg' } });

      // 3. Save the item with real metadata from the dataset
      const saveRes = await fetchWithTimeout(`${API_BASE_URL}/wardrobe/items`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId, s3Key: key, category, color, occasionTags, season }),
      });

      if (!saveRes.ok) throw new Error(JSON.stringify(await saveRes.json()));
      const saved = await saveRes.json();

      // 4. Add the product name as a follow-up patch (name isn't part of item creation)
      if (row.productDisplayName) {
        await fetchWithTimeout(`${API_BASE_URL}/wardrobe/items/${saved.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: row.productDisplayName }),
        });
      }

      doneIds.add(row.id);
      success++;
      console.log(`✓ [${success + failed}/${toImport.length}] ${row.productDisplayName ?? row.id} (${category}, ${color})`);
    } catch (err) {
      failed++;
      console.error(`✗ [${success + failed}/${toImport.length}] Failed on product ${row.id}:`, err.message);
    }

    // Save progress after every item so a crash/interrupt doesn't lose work
    saveProgress(doneIds);
    await sleep(DELAY_BETWEEN_UPLOADS_MS);
  }

  console.log(`\nDone. ${success} imported, ${failed} failed.`);
  console.log(`Total imported across all runs: ${doneIds.size}`);
  console.log('Re-run this script anytime to import more — it automatically skips items already done.');
}

main().catch((err) => {
  console.error('Import script failed:', err.message);
  process.exit(1);
});
