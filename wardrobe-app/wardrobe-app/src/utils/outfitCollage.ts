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
): { top: number; left: number; thumbSize: number; zIndex: number }[] {
  const roles = items.map((i) => classifyRole(i.category));
  const positions: { top: number; left: number; thumbSize: number; zIndex: number }[] = new Array(items.length);

  // QA (regressed once already — re-applying): only 'top' used to
  // stagger every matching item (via topIdxs); every other role used
  // roles.findIndex(...), which only ever finds the FIRST item of that
  // role — a second pair of shoes, second bag, etc. got no position at
  // all and fell through to the generic diagonal fallback below,
  // stacking directly on top of (and fully hiding) the first one. Every
  // role now collects ALL its matching indices, same as 'top' already did.
  const bottomIdxs = roles.map((r, i) => (r === 'bottom' ? i : -1)).filter((i) => i >= 0);
  const topIdxs = roles.map((r, i) => (r === 'top' ? i : -1)).filter((i) => i >= 0);
  const shoeIdxs = roles.map((r, i) => (r === 'shoes' ? i : -1)).filter((i) => i >= 0);
  const bagIdxs = roles.map((r, i) => (r === 'bag' ? i : -1)).filter((i) => i >= 0);
  const accessoryIdxs = roles.map((r, i) => (r === 'accessory' ? i : -1)).filter((i) => i >= 0);
  const bottomIdx = bottomIdxs[0] ?? -1;
  const shoeIdx = shoeIdxs[0] ?? -1;
  const bagIdx = bagIdxs[0] ?? -1;
  const accessoryIdx = accessoryIdxs[0] ?? -1;

  // Bug: pieces used to render in whatever order they happened to sit
  // in the outfit's item list, with no relation to how they'd actually
  // be worn — so a bottom (pants) added to the outfit after a top
  // (shirt) would render on top of it in the pile and fully hide it,
  // even though a shirt always sits over pants in real life. Every
  // piece now carries an explicit zIndex by role — bottoms sit lowest,
  // tops layer above them, shoes/bags/accessories sit highest — so the
  // stack always reads correctly regardless of the order items were
  // added in.
  const ZINDEX: Record<CollageRole, number> = { bottom: 1, top: 2, shoes: 3, bag: 3, accessory: 4 };

  bottomIdxs.forEach((idx, n) => {
    positions[idx] = { top: 28 + n * 10, left: 20 + n * 8, thumbSize: 108 - n * 8, zIndex: ZINDEX.bottom + n };
  });

  topIdxs.forEach((idx, n) => {
    const noBottom = bottomIdx < 0;
    positions[idx] = {
      top: n === 0 ? 0 : 14 + n * 22,
      left: n === 0 ? 22 : 30 + n * 6,
      thumbSize: noBottom ? 120 - n * 6 : 92 - n * 4,
      zIndex: ZINDEX.top + n,
    };
  });

  shoeIdxs.forEach((idx, n) => {
    positions[idx] = { top: 132 - n * 4, left: (bottomIdx >= 0 ? 4 : 90) + n * 26, thumbSize: 54 - n * 6, zIndex: ZINDEX.shoes + n };
  });
  bagIdxs.forEach((idx, n) => {
    positions[idx] = { top: 4 + n * 30, left: 96, thumbSize: 48 - n * 6, zIndex: ZINDEX.bag + n };
  });
  accessoryIdxs.forEach((idx, n) => {
    positions[idx] = {
      top: 2 + n * 24,
      left: (shoeIdx >= 0 || bagIdx >= 0 ? 96 : 100),
      thumbSize: 36 - n * 4,
      zIndex: ZINDEX.accessory + n,
    };
  });

  const withFallback = positions.map((p, i) => p ?? { top: 20 + i * 20, left: 20, thumbSize: 80, zIndex: 1 });
  if (scale === 1) return withFallback;
  return withFallback.map((p) => ({ top: p.top * scale, left: p.left * scale, thumbSize: p.thumbSize * scale, zIndex: p.zIndex }));
}
