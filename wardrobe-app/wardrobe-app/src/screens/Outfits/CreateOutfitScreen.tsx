// src/screens/Outfits/CreateOutfitScreen.tsx
// Now doubles as the "Edit outfit" screen too — pass an existing
// outfit's id via route params (editOutfitId) and this pre-fills the
// selection and PATCHes instead of creating a new one. Also sections
// the item picker into Tops/Bottoms/Dresses/Shoes/Bags/Outerwear/Other
// (mirroring the board's Tops/Pants/Shoes/Bags layout) instead of one
// flat unsorted grid — same category-prefix logic the backend's
// pickOutfitItems() uses, kept in sync manually since this is a
// display-only client-side grouping, not something the server needs
// to compute.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FigmaIcon } from '../../components/icons/FigmaIcon';
import { Chip } from '../../components/Chip';

// Same idea as Ara's occasion picker (OccasionScreen) — Chip renders a
// blank colored circle when it has no emoji to show, which is exactly
// what these looked like (peach circles, no icon). One emoji per
// outfit category so they read the same way Ara's do.
const CATEGORY_EMOJI: Record<string, string> = {
  casual: '👕', formal: '🎩', business: '💼',
  evening_wear: '✨', sport: '🏃', party_wear: '🎉',
};
import { TagPill } from '../../components/TagPill';
import { ItemThumb } from '../../components/ItemThumb';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { getWardrobeItems, createOutfit, updateOutfit, getOutfit, getOutfitCategories, getAttributeSuggestions } from '../../api/wardrobeApi';
import { useUnsavedChangesWarning } from '../../utils/useUnsavedChangesWarning';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

const SLOT_PREFIX_GROUPS: Record<string, string[]> = {
  Tops: ['top', 'shirt', 't_shirt', 'blouse', 'tank_top', 'sweater', 'hoodie', 'kurti', 'tunic', 'camisole', 'bodysuit'],
  Dresses: ['dress', 'jumpsuit', 'kurta_set', 'saree', 'gown'],
  Bottoms: ['bottom', 'pants', 'jeans', 'trousers', 'shorts', 'skirt', 'leggings', 'track_pants', 'joggers', 'capris', 'lounge_pants', 'culottes'],
  Shoes: ['shoes', 'sneakers', 'heels', 'flats', 'sandals', 'flip_flops', 'boots', 'sports_sandals'],
  Bags: ['bag', 'handbag', 'backpack', 'clutch', 'mobile_pouch'],
  Outerwear: ['outerwear', 'jacket', 'coat', 'blazer', 'cardigan', 'kimono', 'cape', 'shrug', 'bath_robe', 'mufflers'],
};
const SLOT_ORDER = ['Tops', 'Dresses', 'Bottoms', 'Shoes', 'Bags', 'Outerwear', 'Other'];

function sectionFor(category: string): string {
  for (const [section, prefixes] of Object.entries(SLOT_PREFIX_GROUPS)) {
    if (prefixes.some((p) => category === p || category.startsWith(`${p}_`))) return section;
  }
  return 'Other';
}

export default function CreateOutfitScreen() {
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const editOutfitId: string | undefined = route.params?.editOutfitId;

  const [items, setItems] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [aesthetic, setAesthetic] = useState<string | null>(null);
  const [aesthetics, setAesthetics] = useState<string[]>(['clean_girl', 'old_money', 'y2k', 'streetwear', 'cottagecore', 'dark_academia', 'minimalist', 'preppy']);
  const [categories, setCategories] = useState<string[]>(['casual', 'formal', 'business', 'evening_wear', 'sport']);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!editOutfitId);
  const savedSuccessfully = React.useRef(false);
  const originalValues = React.useRef<{ name: string; category: string | null; aesthetic: string | null; selectedIds: string[] } | null>(null);

  useEffect(() => {
    getWardrobeItems().then(setItems).catch(() => {});
    getOutfitCategories().then((c) => setCategories([...c.systemCategories, ...c.customCategories])).catch(() => {});
    getAttributeSuggestions().then((s) => { if (s.aesthetics) setAesthetics(s.aesthetics); }).catch(() => {});
    if (editOutfitId) {
      getOutfit(editOutfitId).then((o) => {
        setName(o.name ?? '');
        setCategory(o.category ?? null);
        setAesthetic(o.aesthetic ?? null);
        setSelectedIds(o.itemIds ?? []);
        originalValues.current = { name: o.name ?? '', category: o.category ?? null, aesthetic: o.aesthetic ?? null, selectedIds: o.itemIds ?? [] };
        setLoaded(true);
      }).catch(() => setLoaded(true));
    }
  }, [editOutfitId]);

  // QA flagged this app-wide: leaving a create/edit screen with
  // unsaved changes gave no warning at all. For a new outfit, "changed"
  // means anything's been entered at all; for editing an existing one,
  // it's a real comparison against what was actually loaded, so
  // opening to edit and leaving without touching anything doesn't
  // false-trigger a warning.
  useUnsavedChangesWarning(React.useCallback(() => {
    if (savedSuccessfully.current) return false;
    if (!editOutfitId) {
      return name.trim() !== '' || selectedIds.length > 0 || category !== null || aesthetic !== null;
    }
    const orig = originalValues.current;
    if (!orig) return false;
    return (
      name !== orig.name || category !== orig.category || aesthetic !== orig.aesthetic ||
      JSON.stringify([...selectedIds].sort()) !== JSON.stringify([...orig.selectedIds].sort())
    );
  }, [editOutfitId, name, category, aesthetic, selectedIds]));

  const toggleItem = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSave = async () => {
    if (selectedIds.length === 0) return Alert.alert('Pick some items', 'Select at least one piece for this outfit.');
    // Previously this let the user bypass naming entirely via a "Save
    // as 'Untitled outfit'" option — QA flagged this as confusing and
    // asked for a hard requirement instead: no name, no save, just a
    // clear blocking message telling them what's missing.
    if (!name.trim()) {
      Alert.alert('Please enter a name for the outfit', undefined, [{ text: 'OK' }]);
      return;
    }
    doSave();
  };

  const doSave = async () => {
    setSaving(true);
    try {
      if (editOutfitId) {
        await updateOutfit(editOutfitId, { name: name.trim() || null, category, aesthetic, itemIds: selectedIds, itemIdsBySlot: { tops: selectedIds, pants: [], shoes: [], bags: [], other: [] } });
      } else {
        await createOutfit({
          name: name.trim() || null,
          itemIdsBySlot: { tops: selectedIds, pants: [], shoes: [], bags: [], other: [] },
          category, aesthetic,
        });
      }
      savedSuccessfully.current = true;
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  };

  const sections = SLOT_ORDER
    .map((section) => ({ section, items: items.filter((i) => sectionFor(i.category) === section) }))
    .filter((s) => s.items.length > 0);

  // Bug: with a big closet, this whole picker was one giant ScrollView
  // showing every single item in every category at once — hundreds of
  // items to scroll past just to find one pair of shoes. Sections are
  // now collapsible (closed by default; only the first one starts
  // open, since it's usually what you reach for first) — tap a
  // category to reveal its items instead of everything being on-screen
  // at once. Typing in the search box below overrides this: it
  // auto-opens and filters every section that has a match, so search
  // and browse-by-category both work without getting in each other's
  // way.
  const [search, setSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set(sections[0] ? [sections[0].section] : []));
  const toggleSection = (section: string) =>
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(section) ? next.delete(section) : next.add(section);
      return next;
    });

  const searchLower = search.trim().toLowerCase();
  const visibleSections = searchLower
    ? sections
        .map((s) => ({ section: s.section, items: s.items.filter((i) => `${i.color} ${i.category} ${i.name ?? ''}`.toLowerCase().includes(searchLower)) }))
        .filter((s) => s.items.length > 0)
    : sections;

  if (!loaded) return <SafeAreaView style={styles.container} />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{editOutfitId ? 'Edit Outfit' : 'Create Outfit'}</Text>

        {sections.length === 0 && <Text style={styles.empty}>Add closet items first.</Text>}
        {sections.length > 0 && (
          <View style={styles.searchWrap}>
            <FigmaIcon name="filter" size={14} color={colors.inkMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search your closet…"
              placeholderTextColor={colors.inkMuted}
            />
          </View>
        )}
        {visibleSections.length === 0 && searchLower !== '' && <Text style={styles.empty}>No items match "{search}".</Text>}
        {visibleSections.map(({ section, items: sectionItems }) => {
          const isOpen = searchLower !== '' || expandedSections.has(section);
          return (
            <View key={section}>
              <TouchableOpacity style={styles.sectionHeaderRow} onPress={() => toggleSection(section)} activeOpacity={0.7}>
                <Text style={styles.sectionLabel}>{section}</Text>
                <View style={styles.sectionHeaderRight}>
                  <Text style={styles.sectionCount}>{sectionItems.length}</Text>
                  <FigmaIcon name="chevronDown" size={14} color={colors.inkMuted} style={isOpen ? styles.chevronOpen : undefined} />
                </View>
              </TouchableOpacity>
              {isOpen && (
                <View style={styles.itemGrid}>
                  {sectionItems.map((item) => (
                    <TouchableOpacity key={item.id} style={styles.itemTile} onPress={() => toggleItem(item.id)} activeOpacity={0.8}>
                      <ItemThumb item={item} size={84} selected={selectedIds.includes(item.id)} />
                      <Text style={styles.itemLabel} numberOfLines={1}>{item.color} {item.category?.replace(/_/g, ' ')}</Text>
                      {selectedIds.includes(item.id) && (
                        <View style={styles.selectedBadge}><FigmaIcon name="checkmark" size={12} color={colors.white} /></View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Category</Text>
        <View style={styles.chipRow}>
          {categories.map((c) => <Chip key={c} label={c.replace(/_/g, ' ')} emoji={CATEGORY_EMOJI[c]} selected={category === c} onPress={() => setCategory(c)} />)}
        </View>

        {/* Aesthetic/vibe tag — separate from Category on purpose: this
            is the trend vocabulary people actually describe a look
            with ("clean girl", "y2k") rather than a functional label
            like "casual"/"business". Feeds Ara's outfit picking and
            the Outfits filter panel. */}
        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Vibe / aesthetic (optional)</Text>
        <View style={styles.pillRow}>
          {aesthetics.map((a) => (
            <TagPill key={a} label={a.replace(/_/g, ' ')} selected={aesthetic === a} onPress={() => setAesthetic(aesthetic === a ? null : a)} />
          ))}
        </View>

        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Name this outfit</Text>
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Friday date night"
          placeholderTextColor={colors.inkMuted}
          maxLength={60}
        />

        <Button label={editOutfitId ? 'Save changes' : 'Save outfit'} onPress={handleSave} loading={saving} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { ...type.h1, marginBottom: spacing.lg, textAlign: 'center' },
  sectionLabel: { ...type.h3 },
  sectionLabelSpaced: { marginTop: spacing.md, marginBottom: spacing.sm },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.bgSoft,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 40, marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink, paddingVertical: 0 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionCount: { ...type.muted, fontSize: 13 },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  itemTile: { alignItems: 'center', width: 84, position: 'relative' },
  itemLabel: { fontSize: 10.5, color: colors.inkMuted, marginTop: 4, textTransform: 'capitalize', textAlign: 'center' },
  selectedBadge: {
    position: 'absolute', top: -6, right: 4, width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center',
  },
  selectedBadgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap' },
  nameInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md,
    paddingVertical: 12, fontSize: 14, color: colors.ink, backgroundColor: colors.bgSoft, marginBottom: spacing.lg,
  },
  empty: { ...type.muted },
  });
}
