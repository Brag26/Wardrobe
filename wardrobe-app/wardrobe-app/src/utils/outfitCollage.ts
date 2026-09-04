// src/utils/outfitCollage.ts
// Shared by OutfitsScreen (small card collage) and OutfitDetailScreen
// (larger display collage) — extracted so both use IDENTICAL
// positioning logic instead of two copies that could drift apart.
// Base coordinates are calibrated for a 150x187.5 reference card;
// pass `scale` to render at any other size (e.g. 2 for a 300x375
// detail-screen display) without duplicating the layout math.
export type CollageRole = 'bottom' | 'top' | 'shoes' | 'bag' | 'accessory';

export function classifyRole(category: string): CollageRole {
  const c = category.toLowerCase();
  if (/jean|pant|trouser|short|skirt|legging|jogger/.test(c)) return 'bottom';
  if (/shoe|sneaker|boot|heel|sandal|flat|loafer/.test(c)) return 'shoes';
  if (/bag|purse|backpack|tote|clutch/.test(c)) return 'bag';
  if (/sunglass|glass|jewel|hat|belt|scarf|watch|necklace|earring/.test(c)) return 'accessory';
  return 'top'; // shirt, dress, jacket, hoodie, blazer, sweater, etc. — anything not caught above
}

// Real flat-lay composition, not a blind stack by array order —
// bottoms get their own large dedicated zone (usually the visual
// anchor), tops layer directly on each other when there's more than
// one, and shoes/bags/accessories tuck into the remaining corners,
// smaller.
export function collageLayout(
  items: { category: string }[],
  scale = 1
): { top: number; left: number; thumbSize: number }[] {
  const roles = items.map((i) => classifyRole(i.category));
  const positions: { top: number; left: number; thumbSize: number }[] = new Array(items.length);

  const bottomIdx = roles.findIndex((r) => r === 'bottom');
  const topIdxs = roles.map((r, i) => (r === 'top' ? i : -1)).filter((i) => i >= 0);
  const shoeIdx = roles.findIndex((r) => r === 'shoes');
  const bagIdx = roles.findIndex((r) => r === 'bag');
  const accessoryIdx = roles.findIndex((r) => r === 'accessory');

  if (bottomIdx >= 0) positions[bottomIdx] = { top: 28, left: 20, thumbSize: 108 };

  topIdxs.forEach((idx, n) => {
    const noBottom = bottomIdx < 0;
    positions[idx] = {
      top: n === 0 ? 0 : 14 + n * 22,
      left: n === 0 ? 22 : 30 + n * 6,
      thumbSize: noBottom ? 120 - n * 6 : 92 - n * 4,
    };
  });

  if (shoeIdx >= 0) positions[shoeIdx] = { top: 132, left: bottomIdx >= 0 ? 4 : 90, thumbSize: 54 };
  if (bagIdx >= 0) positions[bagIdx] = { top: 4, left: 96, thumbSize: 48 };
  if (accessoryIdx >= 0) positions[accessoryIdx] = { top: 2, left: shoeIdx >= 0 || bagIdx >= 0 ? 96 : 100, thumbSize: 36 };

  const withFallback = positions.map((p, i) => p ?? { top: 20 + i * 20, left: 20, thumbSize: 80 });
  if (scale === 1) return withFallback;
  return withFallback.map((p) => ({ top: p.top * scale, left: p.left * scale, thumbSize: p.thumbSize * scale }));
}
