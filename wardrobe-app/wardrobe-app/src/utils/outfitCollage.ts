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

  const indicesOf = (role: CollageRole) => roles.map((r, i) => (r === role ? i : -1)).filter((i) => i >= 0);
  const bottomIdxs = indicesOf('bottom');
  const topIdxs = indicesOf('top');
  const shoeIdxs = indicesOf('shoes');
  const bagIdxs = indicesOf('bag');
  const accessoryIdxs = indicesOf('accessory');

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

  // Bug (this is the one making a piece fully invisible): only the
  // FIRST item of each non-"top" role got a real slot, via
  // `roles.findIndex(...)`. Any additional item sharing that same role
  // — a second bag, or a belt AND sunglasses both classifying as
  // "accessory" — had no slot assigned and fell through to the generic
  // fallback below, which places purely by the item's index in the
  // array (`top: 20 + i * 20, left: 20`). That fallback box can land
  // almost exactly on top of the "bottom" piece's box, and since they
  // then tie on zIndex, whichever one happens to come later in the
  // outfit's item order paints over the other — completely hiding it,
  // regardless of which piece it actually was. Every occurrence of a
  // role now gets its own staggered slot (the same approach already
  // used for multiple "top" pieces below), so duplicates never land on
  // an already-placed piece.
  bottomIdxs.forEach((idx, n) => {
    positions[idx] = { top: 28 + n * 18, left: 20 + n * 12, thumbSize: 108 - n * 14, zIndex: ZINDEX.bottom + n * 0.1 };
  });

  topIdxs.forEach((idx, n) => {
    const noBottom = bottomIdxs.length === 0;
    positions[idx] = {
      top: n === 0 ? 0 : 14 + n * 22,
      left: n === 0 ? 22 : 30 + n * 6,
      thumbSize: noBottom ? 120 - n * 6 : 92 - n * 4,
      zIndex: ZINDEX.top + n,
    };
  });

  shoeIdxs.forEach((idx, n) => {
    positions[idx] = { top: 132 - n * 6, left: (bottomIdxs.length > 0 ? 4 : 90) + n * 22, thumbSize: 54 - n * 10, zIndex: ZINDEX.shoes + n * 0.1 };
  });
  bagIdxs.forEach((idx, n) => {
    positions[idx] = { top: 4 + n * 22, left: 96 - n * 6, thumbSize: 48 - n * 10, zIndex: ZINDEX.bag + n * 0.1 };
  });
  accessoryIdxs.forEach((idx, n) => {
    positions[idx] = { top: 2 + n * 20, left: (shoeIdxs.length > 0 || bagIdxs.length > 0 ? 96 : 100) - n * 6, thumbSize: 36 - n * 8, zIndex: ZINDEX.accessory + n * 0.1 };
  });

  // Every item classifies into one of the five roles above (classifyRole
  // always returns one), so this fallback should never actually be hit
  // now — kept only as a defensive default in case a role is ever added
  // here without a matching layout branch.
  const withFallback = positions.map((p, i) => p ?? { top: 20 + i * 20, left: 20, thumbSize: 80, zIndex: 1 });
  if (scale === 1) return withFallback;
  return withFallback.map((p) => ({ top: p.top * scale, left: p.left * scale, thumbSize: p.thumbSize * scale, zIndex: p.zIndex }));
}
