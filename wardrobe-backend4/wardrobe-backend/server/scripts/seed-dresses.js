// server/scripts/seed-dresses.js
//
// Adds a handful of sample dresses to your closet via the real API —
// no photos needed (the app shows a colored+emoji placeholder for any
// item without a real photo, same as the earlier test client did).
//
// Usage:
//   1. Make sure your backend is running (npm run dev) with
//      DEV_LOGIN_ENABLED=true in .env
//   2. From the server/ folder, run:
//        node scripts/seed-dresses.js
//   3. Open the app — Closet tab should now show these dresses.
//
// Edit PHONE below if you want to seed a different test account, or
// edit the DRESSES array to change what gets added.

const API_BASE_URL = 'http://localhost:4000/api';
const PHONE = '+919876543210';

const DRESSES = [
  { color: 'black', brand: 'Zara', price: 2999, occasionTags: ['party', 'date'], season: 'winter', style: 'evening_wear' },
  { color: 'red', brand: 'H&M', price: 1899, occasionTags: ['party', 'event'], season: 'all_season', style: 'party_wear' },
  { color: 'white', brand: 'Mango', price: 2499, occasionTags: ['wedding', 'brunch'], season: 'summer', style: 'formal' },
  { color: 'navy', brand: 'Forever 21', price: 1599, occasionTags: ['office', 'event'], season: 'autumn', style: 'business' },
  { color: 'pink', brand: 'Vero Moda', price: 1799, occasionTags: ['date', 'brunch'], season: 'spring', style: 'casual' },
  { color: 'green', brand: 'Only', price: 2199, occasionTags: ['coffee', 'travel'], season: 'summer', style: 'casual' },
];

async function main() {
  console.log(`Logging in as ${PHONE} via dev-login...`);
  const loginRes = await fetch(`${API_BASE_URL}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE }),
  });
  const loginBody = await loginRes.json();
  if (!loginRes.ok) {
    console.error('Login failed:', loginBody);
    console.error('Make sure DEV_LOGIN_ENABLED=true is set in your .env');
    process.exit(1);
  }
  const token = loginBody.token;
  console.log('Logged in.\n');

  for (const dress of DRESSES) {
    // 1. Get a presigned upload slot (no real photo uploaded — that's fine)
    const uploadRes = await fetch(`${API_BASE_URL}/wardrobe/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fileExtension: 'jpg' }),
    });
    const { itemId, key } = await uploadRes.json();

    // 2. Save the item metadata
    const saveRes = await fetch(`${API_BASE_URL}/wardrobe/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        itemId, s3Key: key,
        category: 'dress',
        color: dress.color,
        occasionTags: dress.occasionTags,
        brand: dress.brand,
        price: dress.price,
        season: dress.season,
        style: dress.style,
      }),
    });

    if (saveRes.ok) {
      console.log(`✓ Added ${dress.color} dress (${dress.brand}, ₹${dress.price})`);
    } else {
      console.error(`✗ Failed to add ${dress.color} dress:`, await saveRes.json());
    }
  }

  console.log(`\nDone. Added ${DRESSES.length} dresses to the closet for ${PHONE}.`);
  console.log('Open the app and use Dev Login with the same number to see them.');
}

main().catch((err) => {
  console.error('Seed script failed:', err.message);
  process.exit(1);
});
