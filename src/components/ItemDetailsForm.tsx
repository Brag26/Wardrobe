// src/components/ItemDetailsForm.tsx
// Shared "Add Details" form (category, color, occasions, style,
// season, rating, brand, price, size, material) — used by both
// AddItemScreen (creating a new item) and ItemDetailsScreen (editing
// an existing one). Previously these fields existed in the data model
// and showed up read-only on Item Details, but there was NO form
// anywhere that actually let a person fill them in — this closes that
// gap for both flows at once instead of duplicating the same UI twice.
import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { FigmaIcon } from './icons/FigmaIcon';
import { TagPill } from './TagPill';
import { spacing, radius } from '../theme/theme';
import { useAppTheme } from '../theme/ThemeContext';

export interface ItemFormValues {
  name: string;
  category: string | null;
  color: string | null;
  occasionTags: string[];
  style: string | null;
  season: string | null;
  rating: number | null;
  brand: string;
  price: string;
  size: string;
  material: string;
}

export const EMPTY_ITEM_FORM: ItemFormValues = {
  name: '', category: null, color: null, occasionTags: [], style: null, season: null,
  rating: null, brand: '', price: '', size: '', material: '',
};

interface ItemDetailsFormProps {
  value: ItemFormValues;
  onChange: (patch: Partial<ItemFormValues>) => void;
  categories: string[];
  colorOptions: string[];
  styleOptions: string[];
  seasonOptions: string[];
  categorySearch: string;
  onCategorySearchChange: (v: string) => void;
}

const OCCASIONS = ['office', 'coffee', 'date', 'party', 'wedding', 'travel', 'brunch', 'beach', 'event'];
const COLOR_SWATCHES: Record<string, string> = {
  black: '#222', white: '#eee', cream: '#efe6d3', grey: '#999', beige: '#d8c7a8',
  red: '#b13c3c', pink: '#e8a0b8', navy: '#213258', green: '#3f6b3f', blue: '#3a5fa0', brown: '#6b4a30',
  orange: '#d97b3f', yellow: '#e5c15c', purple: '#8a5fbf', burgundy: '#6b2f3a', olive: '#6b6b3a',
};

// Category picker grouping — with ~150 possible categories, a flat
// wrapped wall of pills before anyone types a search term looks
// exactly as messy as it sounds. Grouped into labeled, collapsible
// sections instead (collapsed by default, tap to expand) so the
// picker reads as organized rather than overwhelming. Search still
// works as a flat cross-group filter — typing "saree" shouldn't
// require knowing which section it's in.
const CATEGORY_GROUPS: { label: string; prefixes: string[] }[] = [
  { label: 'Tops', prefixes: ['top', 'shirt', 't_shirt', 'blouse', 'tank_top', 'sweater', 'hoodie', 'kurti', 'tunic', 'camisole', 'bodysuit'] },
  { label: 'Bottoms', prefixes: ['bottom', 'pants', 'jeans', 'trousers', 'shorts', 'skirt', 'leggings', 'track_pants', 'joggers', 'capris', 'lounge_pants', 'culottes'] },
  { label: 'Dresses & one-piece', prefixes: ['dress', 'jumpsuit', 'kurta_set', 'saree', 'gown'] },
  { label: 'Outerwear', prefixes: ['outerwear', 'jacket', 'coat', 'blazer', 'cardigan', 'kimono', 'cape', 'shrug', 'bath_robe', 'mufflers'] },
  { label: 'Footwear', prefixes: ['shoes', 'sneakers', 'heels', 'flats', 'sandals', 'flip_flops', 'boots', 'sports_sandals'] },
  { label: 'Bags', prefixes: ['bag', 'handbag', 'backpack', 'clutch', 'mobile_pouch'] },
  { label: 'Accessories & jewellery', prefixes: ['accessory', 'jewellery', 'watch', 'ring', 'bangle', 'belt', 'scarf', 'dupatta', 'cap', 'sunglasses'] },
  { label: 'Intimates', prefixes: ['bra', 'brief', 'thong', 'gstring', 'boyshorts', 'shapewear'] },
  { label: 'Beauty & personal care', prefixes: ['lipstick', 'lip_gloss', 'lip_care', 'kajal_eyeliner', 'foundation_primer', 'highlighter_blush', 'compact', 'nail_polish', 'face_wash_cleanser', 'face_moisturiser', 'perfume_body_mist', 'fragrance_gift_set', 'beauty_accessory'] },
  { label: 'Sleep & loungewear', prefixes: ['nightdress', 'night_suit', 'pajama_set', 'robe', 'baby_doll', 'swimwear'] },
  { label: 'Other', prefixes: ['socks', 'wallet', 'travel_accessory', 'free_gift'] },
];

function groupCategory(category: string): string {
  for (const group of CATEGORY_GROUPS) {
    if (group.prefixes.some((p) => category === p || category.startsWith(`${p}_`))) return group.label;
  }
  return 'Other';
}

export function ItemDetailsForm({
  value, onChange, categories, colorOptions, styleOptions, seasonOptions, categorySearch, onCategorySearchChange,
}: ItemDetailsFormProps) {
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const isSearching = categorySearch.trim().length > 0;
  const flatFiltered = isSearching
    ? categories.filter((c) => c.replace(/_/g, ' ').includes(categorySearch.trim().toLowerCase()))
    : [];

  const groupedCategories = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of categories) {
      const g = groupCategory(c);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(c);
    }
    // Keep CATEGORY_GROUPS order, drop empty groups, "Other" (custom
    // values not matching any known prefix) goes last.
    const ordered = CATEGORY_GROUPS.map((g) => g.label).filter((l) => map.has(l));
    return ordered.map((label) => ({ label, items: map.get(label)! }));
  }, [categories]);

  const toggleOccasion = (o: string) =>
    onChange({ occasionTags: value.occasionTags.includes(o) ? value.occasionTags.filter((x) => x !== o) : [...value.occasionTags, o] });

  return (
    <View>
      <Text style={[type.h3, { marginBottom: spacing.sm }]}>Name (optional)</Text>
      <TextInput
        style={styles.input}
        value={value.name}
        onChangeText={(t) => onChange({ name: t })}
        placeholder="e.g. Blue denim jacket"
        placeholderTextColor={colors.inkMuted}
        maxLength={60}
      />

      <Text style={[type.h3, { marginTop: spacing.md, marginBottom: spacing.sm }]}>Category</Text>
      {categories.length > 12 && (
        <TextInput
          style={styles.categorySearchInput}
          value={categorySearch}
          onChangeText={onCategorySearchChange}
          placeholder="Search categories (e.g. kurti, saree, bra)"
          placeholderTextColor={colors.inkMuted}
        />
      )}

      {isSearching ? (
        <View style={styles.pillRow}>
          {flatFiltered.map((c) => <TagPill key={c} label={c.replace(/_/g, ' ')} selected={value.category === c} onPress={() => onChange({ category: c })} />)}
          {flatFiltered.length === 0 && <Text style={{ color: colors.inkMuted, fontSize: 12 }}>No matches — try a different search.</Text>}
        </View>
      ) : (
        groupedCategories.map(({ label, items }) => {
          const expanded = expandedGroups.has(label);
          const selectedInGroup = items.find((c) => c === value.category);
          return (
            <View key={label} style={styles.groupBlock}>
              <TouchableOpacity style={styles.groupHeader} onPress={() => toggleGroup(label)} activeOpacity={0.7}>
                <Text style={styles.groupHeaderText}>
                  {label}{selectedInGroup ? ` · ${selectedInGroup.replace(/_/g, ' ')}` : ''}
                </Text>
                <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
                  <FigmaIcon name="chevronDown" size={14} color={colors.inkMuted} />
                </View>
              </TouchableOpacity>
              {expanded && (
                <View style={styles.pillRow}>
                  {items.map((c) => <TagPill key={c} label={c.replace(/_/g, ' ')} selected={value.category === c} onPress={() => onChange({ category: c })} />)}
                </View>
              )}
            </View>
          );
        })
      )}

      <Text style={[type.h3, { marginTop: spacing.md, marginBottom: spacing.sm }]}>Color</Text>
      <View style={styles.pillRow}>
        {colorOptions.map((c) => (
          <TagPill key={c} label={c} selected={value.color === c} onPress={() => onChange({ color: c })} dotColor={COLOR_SWATCHES[c]} />
        ))}
      </View>

      <Text style={[type.h3, { marginTop: spacing.md, marginBottom: spacing.sm }]}>Style</Text>
      <View style={styles.pillRow}>
        {styleOptions.map((s) => (
          <TagPill key={s} label={s.replace(/_/g, ' ')} selected={value.style === s} onPress={() => onChange({ style: value.style === s ? null : s })} />
        ))}
      </View>

      <Text style={[type.h3, { marginTop: spacing.md, marginBottom: spacing.sm }]}>Season</Text>
      <View style={styles.pillRow}>
        {seasonOptions.map((s) => (
          <TagPill key={s} label={s.replace(/_/g, ' ')} selected={value.season === s} onPress={() => onChange({ season: value.season === s ? null : s })} />
        ))}
      </View>

      <Text style={[type.h3, { marginTop: spacing.md, marginBottom: spacing.sm }]}>Occasions</Text>
      <View style={styles.pillRow}>
        {OCCASIONS.map((o) => <TagPill key={o} label={o} selected={value.occasionTags.includes(o)} onPress={() => toggleOccasion(o)} />)}
      </View>

      <Text style={[type.h3, { marginTop: spacing.md, marginBottom: spacing.sm }]}>Rating</Text>
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity key={n} onPress={() => onChange({ rating: value.rating === n ? null : n })}>
            <FigmaIcon
              name={value.rating != null && n <= value.rating ? 'star' : 'starOutline'}
              size={26}
              color={colors.border}
            />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[type.h3, { marginTop: spacing.md, marginBottom: spacing.sm }]}>More details (optional)</Text>
      <View style={styles.detailRow}>
        <TextInput style={[styles.input, { flex: 1 }]} value={value.brand} onChangeText={(t) => onChange({ brand: t })} placeholder="Brand" placeholderTextColor={colors.inkMuted} />
        <TextInput style={[styles.input, { flex: 1 }]} value={value.price} onChangeText={(t) => onChange({ price: t.replace(/[^0-9.]/g, '') })} placeholder="Price" keyboardType="numeric" placeholderTextColor={colors.inkMuted} />
      </View>
      <View style={styles.detailRow}>
        <TextInput style={[styles.input, { flex: 1 }]} value={value.size} onChangeText={(t) => onChange({ size: t })} placeholder="Size" placeholderTextColor={colors.inkMuted} />
        <TextInput style={[styles.input, { flex: 1 }]} value={value.material} onChangeText={(t) => onChange({ material: t })} placeholder="Material" placeholderTextColor={colors.inkMuted} />
      </View>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    pillRow: { flexDirection: 'row', flexWrap: 'wrap' },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md,
      paddingVertical: 12, fontSize: 14, color: colors.ink, backgroundColor: colors.bgSoft,
    },
    categorySearchInput: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm,
      paddingVertical: 8, fontSize: 13, color: colors.ink, backgroundColor: colors.bgSoft, marginBottom: spacing.sm,
    },
    groupBlock: { marginBottom: 6 },
    groupHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
      paddingVertical: 10, paddingHorizontal: spacing.sm,
    },
    groupHeaderText: { fontSize: 13, fontWeight: '600', color: colors.ink, textTransform: 'capitalize' },
    starRow: { flexDirection: 'row', gap: spacing.xs },
    detailRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  });
}
