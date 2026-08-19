// src/components/ItemThumb.tsx
// Shows a real photo if the item has one AND it loads successfully;
// falls back to a colored card with a category emoji otherwise — either
// because there's no photo, or because the photo URL exists but fails
// to load (e.g. S3 credentials not fully set up yet). Previously this
// only handled "no photo" and assumed any http(s) URL would load fine,
// which showed a BLANK box whenever the image actually failed — this
// is what was happening with every seeded/imported item, since they
// all point at S3 URLs that can't actually be reached yet.
import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, radius } from '../theme/theme';

// Exact-match first, then PREFIX fallback (e.g. 'dress_bodycon' falls
// back to the 'dress' emoji, 'bra_sports' falls back to 'bra') — same
// approach as the backend's categoryInSlot(), so new subtypes added to
// SUGGESTED_CATEGORIES automatically get a sensible icon without this
// map needing a matching new entry every time.
const CATEGORY_EMOJI: Record<string, string> = {
  top: '👚', shirt: '👚', t_shirt: '👕', blouse: '👚', tank_top: '👚', bodysuit: '👚',
  sweater: '🧶', hoodie: '🧥', kurti: '👚', tunic: '👚', camisole: '👚',
  bottom: '👖', pants: '👖', jeans: '👖', trousers: '👖', shorts: '🩳', skirt: '👗', culottes: '👖',
  leggings: '👖', track_pants: '👖', joggers: '👖', capris: '👖', lounge_pants: '👖',
  dress: '👗', jumpsuit: '👗', kurta_set: '👗', saree: '🥻', gown: '👗',
  outerwear: '🧥', jacket: '🧥', coat: '🧥', blazer: '🧥', cardigan: '🧥', kimono: '🧥', cape: '🧥',
  shrug: '🧥', bath_robe: '🧥', mufflers: '🧣',
  shoes: '👠', sneakers: '👟', heels: '👠', flats: '🥿', sandals: '👡', flip_flops: '🩴', boots: '👢', sports_sandals: '👡',
  bag: '👜', handbag: '👜', backpack: '🎒', clutch: '👛', mobile_pouch: '👛',
  accessory: '💍', jewellery: '💍', watch: '⌚', ring: '💍', bangle: '💍', belt: '🔗', scarf: '🧣', dupatta: '🧣', cap: '🧢', sunglasses: '🕶️',
  lipstick: '💄', lip_gloss: '💄', lip_care: '💄', kajal_eyeliner: '💄', foundation_primer: '💄', highlighter_blush: '💄', compact: '💄',
  nail_polish: '💅', face_wash_cleanser: '🧴', face_moisturiser: '🧴', perfume_body_mist: '🧴', fragrance_gift_set: '🎁', beauty_accessory: '💄',
  nightdress: '👘', night_suit: '👘', pajama_set: '👘', robe: '👘', baby_doll: '👘', swimwear: '👙',
  bra: '👙', brief: '🩲', thong: '🩲', gstring: '🩲', boyshorts: '🩲', shapewear: '🩲',
  socks: '🧦', wallet: '👛', travel_accessory: '🧳', free_gift: '🎁',
};

function getCategoryEmoji(category: string): string {
  if (CATEGORY_EMOJI[category]) return CATEGORY_EMOJI[category];
  const prefix = category.split('_')[0];
  if (CATEGORY_EMOJI[prefix]) return CATEGORY_EMOJI[prefix];
  return '👗';
}
const COLOR_HEX: Record<string, string> = {
  black: '#2a2a2a', white: '#eee', cream: '#efe6d3', red: '#b13c3c', pink: '#e8a0b8',
  navy: '#213258', green: '#3f6b3f', blue: '#3a5fa0', beige: '#d8c7a8', grey: '#8a8a8a', brown: '#6b4a30',
  multicolor: '#c9a9e8', burgundy: '#6b2f3a', orange: '#d97b3f', yellow: '#e5c15c', lavender: '#c9a9e8',
};

interface ItemThumbProps {
  item: { imageUrl?: string; color: string; category: string } | null;
  size?: number;
  onPress?: () => void;
  selected?: boolean;
}

export function ItemThumb({ item, size = 72, selected }: ItemThumbProps) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const height = Math.round(size * 1.25);

  if (!item) {
    return (
      <View style={[styles.wrap, styles.empty, { width: size, height }]}>
        <Text style={{ color: colors.inkMuted, fontSize: 20 }}>?</Text>
      </View>
    );
  }

  const hasPhotoUrl = !!item.imageUrl && item.imageUrl.startsWith('http') && !item.imageUrl.includes('undefined');
  const showRealPhoto = hasPhotoUrl && !photoFailed;
  const bg = COLOR_HEX[item.color] ?? '#999';

  return (
    <View style={[styles.wrap, { width: size, height }, selected && styles.selected]}>
      {showRealPhoto ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.image}
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        <View style={[styles.card, { backgroundColor: bg }]}>
          <Text style={{ fontSize: size * 0.35 }}>{getCategoryEmoji(item.category)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  selected: { borderColor: colors.black, borderWidth: 2 },
  empty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgSoft },
  card: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
});
