// server/scripts/seed-dress-catalog.js
//
// Comprehensive dress catalog — 25 different dress types, spanning
// major brands, price points, sizes, materials, and fits.
//
// HONEST LIMITATION: these do NOT have real photos. There's no live
// connection from this script to real brand product images (and
// scraping/reproducing real brand photography would be a copyright
// problem regardless of technical feasibility). Every item will render
// as a colored card with a category emoji in the app — the same
// reliable placeholder system used everywhere else. Brand names, prices,
// sizes, materials, and fit descriptions are realistic but the actual
// numbers/names are illustrative, not scraped from real listings.
//
// Usage:
//   node scripts/seed-dress-catalog.js
// (same phone number as seed-dresses.js: +919876543210 — safe to run
// both, they just add more items to the same test account)

const API_BASE_URL = 'http://localhost:4000/api';
const PHONE = '+919876543210';

const DRESSES = [
  { type: 'A-line dress', color: 'black', brand: 'Zara', price: 3990, size: 'S', material: 'Viscose', fit: 'A-line silhouette, fitted waist, flared skirt', occasionTags: ['office', 'event'], season: 'all_season', style: 'formal', rating: 4.5 },
  { type: 'Bodycon dress', color: 'red', brand: 'Mango', price: 4290, size: 'M', material: 'Ponte knit', fit: 'Bodycon fit, stretch fabric, knee-length', occasionTags: ['party', 'date'], season: 'all_season', style: 'party_wear', rating: 4.2 },
  { type: 'Maxi dress', color: 'green', brand: 'H&M', price: 2999, size: 'L', material: 'Cotton', fit: 'Relaxed maxi fit, floor-length, flowy', occasionTags: ['beach', 'travel'], season: 'summer', style: 'casual', rating: 4.6 },
  { type: 'Midi dress', color: 'navy', brand: 'Vero Moda', price: 2599, size: 'M', material: 'Crepe', fit: 'Semi-fitted midi length, side slit', occasionTags: ['office', 'brunch'], season: 'autumn', style: 'business', rating: 4.3 },
  { type: 'Mini dress', color: 'pink', brand: 'Forever 21', price: 1799, size: 'S', material: 'Polyester', fit: 'Fitted mini, above-knee', occasionTags: ['party', 'date'], season: 'summer', style: 'party_wear', rating: 4.0 },
  { type: 'Wrap dress', color: 'burgundy', brand: 'Diane von Furstenberg', price: 18999, size: 'M', material: 'Silk blend', fit: 'True wrap with tie waist, V-neck', occasionTags: ['office', 'event'], season: 'all_season', style: 'formal', rating: 4.8 },
  { type: 'Shift dress', color: 'white', brand: 'COS', price: 5490, size: 'S', material: 'Cotton poplin', fit: 'Boxy shift, straight cut, no waist definition', occasionTags: ['office', 'brunch'], season: 'summer', style: 'business', rating: 4.4 },
  { type: 'Slip dress', color: 'cream', brand: 'Mango', price: 3290, size: 'S', material: 'Satin', fit: 'Bias-cut slip, adjustable straps, cowl neck', occasionTags: ['date', 'party'], season: 'summer', style: 'party_wear', rating: 4.3 },
  { type: 'Shirt dress', color: 'blue', brand: 'Marks & Spencer', price: 3499, size: 'M', material: 'Cotton', fit: 'Button-through shirt fit, belted waist', occasionTags: ['office', 'coffee'], season: 'all_season', style: 'casual', rating: 4.1 },
  { type: 'Sundress', color: 'yellow', brand: 'Only', price: 1999, size: 'S', material: 'Cotton', fit: 'Loose fit, spaghetti straps, above-knee', occasionTags: ['beach', 'brunch'], season: 'summer', style: 'casual', rating: 4.5 },
  { type: 'Cocktail dress', color: 'black', brand: 'Reiss', price: 12999, size: 'M', material: 'Crepe', fit: 'Fitted bodice, knee-length, structured', occasionTags: ['party', 'event'], season: 'all_season', style: 'evening_wear', rating: 4.7 },
  { type: 'Evening gown', color: 'navy', brand: 'Vera Wang', price: 45999, size: 'M', material: 'Satin', fit: 'Floor-length, fitted bodice, subtle train', occasionTags: ['wedding', 'event'], season: 'winter', style: 'evening_wear', rating: 4.9 },
  { type: 'Fit-and-flare dress', color: 'pink', brand: 'Ted Baker', price: 8990, size: 'S', material: 'Jacquard', fit: 'Fitted bodice, full flared skirt from waist', occasionTags: ['party', 'wedding'], season: 'spring', style: 'party_wear', rating: 4.4 },
  { type: 'Peplum dress', color: 'red', brand: 'Karen Millen', price: 7490, size: 'M', material: 'Ponte', fit: 'Fitted with peplum flare at hip, structured shoulders', occasionTags: ['office', 'event'], season: 'all_season', style: 'business', rating: 4.2 },
  { type: 'Off-shoulder dress', color: 'white', brand: 'Zara', price: 3599, size: 'S', material: 'Linen blend', fit: 'Off-shoulder neckline, fitted through waist, A-line skirt', occasionTags: ['date', 'beach'], season: 'summer', style: 'casual', rating: 4.3 },
  { type: 'Kaftan dress', color: 'orange', brand: 'Global Desi', price: 2799, size: 'L', material: 'Rayon', fit: 'Loose oversized fit, wide sleeves, floor-length', occasionTags: ['travel', 'beach'], season: 'summer', style: 'casual', rating: 4.1 },
  { type: 'Denim dress', color: 'blue', brand: 'Levi\'s', price: 4599, size: 'M', material: 'Denim', fit: 'Button-front, fitted through bust, A-line skirt', occasionTags: ['coffee', 'travel'], season: 'autumn', style: 'casual', rating: 4.0 },
  { type: 'Sweater dress', color: 'grey', brand: 'Uniqlo', price: 2990, size: 'M', material: 'Wool blend knit', fit: 'Relaxed knit fit, ribbed hem, midi length', occasionTags: ['coffee', 'travel'], season: 'winter', style: 'casual', rating: 4.4 },
  { type: 'Empire waist dress', color: 'lavender', brand: 'Monsoon', price: 5990, size: 'S', material: 'Chiffon', fit: 'Empire waistline, flowy skirt, delicate fabric', occasionTags: ['wedding', 'brunch'], season: 'spring', style: 'formal', rating: 4.5 },
  { type: 'Ball gown', color: 'burgundy', brand: 'Marchesa', price: 68999, size: 'M', material: 'Tulle', fit: 'Fitted bodice, dramatic full skirt, floor-length', occasionTags: ['wedding', 'event'], season: 'winter', style: 'evening_wear', rating: 4.9 },
  { type: 'Tea-length dress', color: 'green', brand: 'Ghost London', price: 6490, size: 'M', material: 'Satin', fit: 'Below-knee, above-ankle length, vintage-inspired', occasionTags: ['event', 'brunch'], season: 'spring', style: 'formal', rating: 4.3 },
  { type: 'Bandage dress', color: 'black', brand: 'Herve Leger', price: 32999, size: 'S', material: 'Rayon-nylon blend', fit: 'Ultra-fitted, body-sculpting bandage construction', occasionTags: ['party', 'event'], season: 'all_season', style: 'party_wear', rating: 4.6 },
  { type: 'Smock dress', color: 'beige', brand: 'Free People', price: 5290, size: 'M', material: 'Cotton gauze', fit: 'Loose smock fit, gathered yoke, relaxed through body', occasionTags: ['brunch', 'travel'], season: 'summer', style: 'casual', rating: 4.2 },
  { type: 'Co-ord set dress', color: 'multicolor', brand: 'Nykaa Fashion', price: 3299, size: 'M', material: 'Georgette', fit: 'Matching two-piece, flared skirt with fitted top', occasionTags: ['event', 'brunch'], season: 'summer', style: 'formal', rating: 4.4 },
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

  let added = 0;
  for (const dress of DRESSES) {
    const uploadRes = await fetch(`${API_BASE_URL}/wardrobe/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fileExtension: 'jpg' }),
    });
    const { itemId, key } = await uploadRes.json();

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
        size: dress.size,
        material: dress.material,
        season: dress.season,
        style: dress.style,
      }),
    });

    if (saveRes.ok) {
      // Add name/description/rating via a follow-up PATCH (item creation
      // endpoint doesn't take name/description/rating directly — matches
      // how the Details screen "edit" flow adds these after the fact).
      const saved = await saveRes.json();
      await fetch(`${API_BASE_URL}/wardrobe/items/${saved.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: dress.type,
          description: dress.fit,
          rating: dress.rating,
        }),
      });
      console.log(`✓ ${dress.type} — ${dress.color} — ${dress.brand} — ₹${dress.price} — size ${dress.size}`);
      added++;
    } else {
      console.error(`✗ Failed: ${dress.type}`, await saveRes.json());
    }
  }

  console.log(`\nDone. Added ${added}/${DRESSES.length} dresses covering ${new Set(DRESSES.map(d => d.type)).size} distinct dress types.`);
  console.log(`Brands included: ${[...new Set(DRESSES.map(d => d.brand))].join(', ')}`);
  console.log('Open the app, Dev Login with the same number, check the Closet tab.');
}

main().catch((err) => {
  console.error('Seed script failed:', err.message);
  process.exit(1);
});
