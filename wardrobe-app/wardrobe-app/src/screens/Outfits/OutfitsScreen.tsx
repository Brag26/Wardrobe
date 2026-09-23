import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Share, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FigmaIcon } from '../../components/icons/FigmaIcon';
import { listOutfits, getOutfitCategories, getItemsByIds, deleteOutfit, updateOutfit, listPackings, getAttributeSuggestions } from '../../api/wardrobeApi';
import { collageLayout } from '../../utils/outfitCollage';
import { ItemThumb } from '../../components/ItemThumb';
import { FilterPanel, FilterValues } from '../../components/FilterPanel';
import { AppHeader } from '../../components/AppHeader';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

const SEASONS = ['summer', 'autumn', 'winter', 'monsoon', 'spring', 'all_season'];

// Positions items in an overlapping flat-lay arrangement instead of a
// bordered grid — one "anchor" piece (usually a top/dress) large and
// upper-center, with the rest layered smaller around it, similar to
// how a real styled flat-lay photo is composed. Card is 150x187.5;
// values below are fractions of that. Capped at showing 4 pieces even
// if an outfit has more, same as before — a 5th+ small item wouldn't
// read clearly at this card size anyway.
// "Drop a dress over a dress" — a genuine stacked pile, not items
// scattered to different corners. Each piece large, centered, and
// heavily overlapping the one before it with just enough vertical
// offset to read as separate garments, like clothes actually dropped
// on top of each other. Later items in the array render on top (React
// Native's default z-order), so item order roughly reads bottom-of-
// pile to top-of-pile.
// Real flat-lay composition, not a blind stack by array order — the
// reference shows bottoms getting their own large dedicated zone
// (usually the visual anchor), tops layering directly on each other
// when there's more than one, and shoes/bags/accessories tucked into
// the remaining corners, smaller. Previously this positioned purely
// by item INDEX, so a bag could end up "anchoring" the composition
// just because it happened to be first in the array — this classifies
// by actual garment type instead.


export default function OutfitsScreen() {
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  const navigation = useNavigation<any>();
  const [outfits, setOutfits] = useState<any[]>([]);
  const [previews, setPreviews] = useState<Record<string, any>>({});
  const [categories, setCategories] = useState<string[]>(['casual', 'formal', 'business', 'evening_wear', 'sport']);
  const [active, setActive] = useState('all');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [packings, setPackings] = useState<any[]>([]);
  const [filters, setFilters] = useState<FilterValues>({});
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [colorOptions, setColorOptions] = useState<string[]>(['black', 'white', 'red', 'blue', 'green', 'pink', 'beige', 'navy']);
  const [aestheticOptions, setAestheticOptions] = useState<string[]>(['clean_girl', 'old_money', 'y2k', 'streetwear', 'cottagecore', 'dark_academia']);

  React.useEffect(() => {
    getAttributeSuggestions().then((s) => { setColorOptions(s.colors); if (s.aesthetics) setAestheticOptions(s.aesthetics); }).catch(() => {});
  }, []);

  // Same fix as ClosetScreen — previously no loading state (so "No
  // outfits in this category yet" could false-trigger during the
  // initial fetch on a slow/cold backend) and a silent `catch {}`.
  const [outfitsLoading, setOutfitsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const load = useCallback(async (cat: string, activeFilters: FilterValues) => {
    setOutfitsLoading(true);
    try {
      const filterParams: Record<string, string> = {};
      if (activeFilters.season) filterParams.season = activeFilters.season;
      if (activeFilters.color) filterParams.color = activeFilters.color;
      if (activeFilters.minRating) filterParams.minRating = String(activeFilters.minRating);
      if (activeFilters.aesthetic) filterParams.aesthetic = activeFilters.aesthetic;
      const [outfitData, catData, packingData] = await Promise.all([listOutfits(cat, filterParams), getOutfitCategories(), listPackings()]);
      setOutfits(outfitData);
      setCategories([...catData.systemCategories, ...catData.customCategories]);
      setPackings(packingData);

      // Resolve EVERY piece in EVERY outfit (not just the first item) so
      // the card can show the whole look, not one lone thumbnail —
      // listOutfits() only returns item ids, not photos/colors.
      const allIds = outfitData.flatMap((o: any) => o.itemIds ?? []).filter(Boolean);
      if (allIds.length > 0) {
        const resolved = await getItemsByIds([...new Set(allIds)] as string[]);
        const map: Record<string, any> = {};
        resolved.forEach((item: any) => { map[item.id] = item; });
        setPreviews(map);
      }
    } catch (e: any) {
      console.error('[OutfitsScreen] load failed:', e);
    } finally {
      setOutfitsLoading(false);
      setHasLoadedOnce(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(active, filters); }, [active, filters, load]));

  const handleDelete = (id: string, name?: string) => {
    Alert.alert(
      'Delete outfit?',
      `${name ? `"${name}"` : 'This outfit'} will be moved to the bin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Optimistic update so the card disappears immediately.
            setOutfits((prev) => prev.filter((o) => o.id !== id));
            try {
              await deleteOutfit(id);
            } catch {
              Alert.alert("Couldn't delete", 'Something went wrong — try again.');
              load(active, filters);
            }
          },
        },
      ]
    );
  };

  const handleSaveName = async () => {
    if (!renaming) return;
    const trimmed = renaming.name.trim();
    setSavingName(true);
    try {
      await updateOutfit(renaming.id, { name: trimmed || null });
      setOutfits((prev) => prev.map((o) => (o.id === renaming.id ? { ...o, name: trimmed || null } : o)));
      setRenaming(null);
    } catch {
      Alert.alert("Couldn't rename", 'Something went wrong — try again.');
    } finally {
      setSavingName(false);
    }
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const handleShare = async (outfit: any) => {
    // Text-based share via React Native's built-in Share API — a real
    // shareable-image card (like the "Successfully Wrapped" screen's
    // visual style) would need react-native-view-shot to snapshot a
    // view as an image, which isn't in this project and would need a
    // native rebuild to add. This ships a genuinely shareable, nicely
    // worded caption now rather than nothing; swapping in an image
    // export is a clean follow-up once that dependency's in place.
    const pieces = outfit.itemIds?.length ?? 0;
    const vibe = outfit.aesthetic ? ` (${outfit.aesthetic.replace(/_/g, ' ')} vibes ✨)` : '';
    const scoreLine = outfit.matchScore != null ? `\n${outfit.matchScore}% match` : '';
    const message = `${outfit.name ?? 'My outfit'}${vibe}\n${pieces} piece${pieces === 1 ? '' : 's'}, styled with Ara${scoreLine}`;
    try {
      await Share.share({ message });
    } catch {}
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <AppHeader />
      <View style={styles.header}>
        <Text style={styles.title}>My Outfits</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.xs, flexShrink: 1 }}>
          <TouchableOpacity style={styles.filterButton} onPress={() => setFilterPanelOpen(true)}>
            <FigmaIcon name="filter" size={13} color={colors.ink} />
            {activeFilterCount > 0 && <Text style={styles.filterButtonText}> {activeFilterCount}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.packButton} onPress={() => navigation.navigate('StartPacking')}>
            <Ionicons name="briefcase-outline" size={12} color={colors.ink} />
            <Text style={styles.packButtonText}> Start packing</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('CreateOutfit')}>
            <FigmaIcon name="add" size={13} color={colors.white} />
            <Text style={styles.addButtonText}> Create</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Browse by category</Text>
      <FlatList
        horizontal
        data={['all', ...categories]}
        keyExtractor={(c) => c}
        showsHorizontalScrollIndicator={false}
        style={styles.tabList}
        contentContainerStyle={styles.tabRow}
        renderItem={({ item: c }) => (
          <TouchableOpacity onPress={() => setActive(c)} style={[styles.tab, active === c && styles.tabActive]}>
            <Text style={[styles.tabText, active === c && styles.tabTextActive]}>{c.replace('_', ' ')}</Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={outfits}
        keyExtractor={(o) => o.id}
        numColumns={2}
        style={{ flex: 1 }}
        columnWrapperStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.lg }}
        ListEmptyComponent={
          outfitsLoading && !hasLoadedOnce ? (
            <View style={{ paddingTop: spacing.xxl, alignItems: 'center' }}>
              <ActivityIndicator color={colors.inkMuted} />
            </View>
          ) : (
            <Text style={styles.empty}>No outfits in this category yet.</Text>
          )
        }
        ListHeaderComponent={packings.length > 0 ? (
          <View style={{ marginBottom: spacing.md }}>
            <View style={styles.packingHeaderRow}>
              <Text style={styles.packingSectionTitle}>My packing</Text>
              <Text style={styles.packingViewAll} onPress={() => {}}>{packings.length} trip{packings.length === 1 ? '' : 's'}</Text>
            </View>
            <FlatList
              horizontal
              data={packings}
              keyExtractor={(p) => p.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
              renderItem={({ item: p }) => (
                <TouchableOpacity style={styles.packingCard} onPress={() => navigation.navigate('PackingDetail', { packingId: p.id })} activeOpacity={0.85}>
                  {p.coverImageUrl ? (
                    <View style={styles.packingCoverWrap}><ItemThumb item={{ imageUrl: p.coverImageUrl, category: 'trip', color: '' }} size={116} /></View>
                  ) : (
                    <View style={[styles.packingCoverWrap, styles.packingCoverPlaceholder]}><Ionicons name="briefcase-outline" size={28} color={colors.inkMuted} /></View>
                  )}
                  <Text style={styles.packingCardName} numberOfLines={1}>{p.name ?? 'Untitled trip'}</Text>
                  {(p.startDate || p.endDate) && <Text style={styles.packingCardDates}>{p.startDate ?? '?'} - {p.endDate ?? '?'}</Text>}
                  <Text style={styles.packingCardCount}>{p.outfitIds?.length ?? 0} outfit{(p.outfitIds?.length ?? 0) === 1 ? '' : 's'} packing</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        ) : null}
        renderItem={({ item }) => {
          const pieces = (item.itemIds ?? []).map((id: string) => previews[id]).filter(Boolean);
          // Same fix as OutfitDetailScreen — an item whose background
          // removal hasn't finished/failed still shows its RAW photo
          // (visible white background, sometimes the model still in
          // frame). Left in the overlapping pile, that opaque photo
          // hides whatever's stacked underneath it — only genuinely
          // processed items go into the collage here.
          const shown = pieces.filter((p: any) => p.backgroundRemoval?.status === 'done').slice(0, 4);
          const isRecent = item.createdAt && (Date.now() - item.createdAt) < 48 * 60 * 60 * 1000;
          return (
            <View style={styles.card}>
              {isRecent && (
                <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>
              )}
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => handleShare(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="share-outline" size={13} color={colors.white} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(item.id, item.name)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {/* QA flagged this — it already performs a real delete
                    (handleDelete), but used the "close" (X) icon,
                    which reads as "dismiss this card" rather than
                    "delete this outfit." Trash icon matches what it
                    actually does. */}
                <FigmaIcon name="trash" size={13} color={colors.white} />
              </TouchableOpacity>

              {/* Whole outfit as one blended flat-lay, not a bordered
                  grid of separate boxed thumbnails — previously each
                  item sat in its own bounded, bordered slot (visible
                  gaps between pieces). Since items already have their
                  background removed (transparent PNG), they can be
                  layered directly onto one shared card background at
                  overlapping positions, the way a real styled flat-lay
                  photo looks — no visible borders around each piece,
                  no grid lines separating them. Falls back to a single
                  centered item for a 1-piece outfit. */}
              <TouchableOpacity
                style={styles.collageWrap}
                onPress={() => navigation.navigate('OutfitDetail', { outfitId: item.id })}
                activeOpacity={0.85}
              >
                {shown.length > 1 ? (
                  collageLayout(shown).map((pos, idx) => (
                    <View key={idx} style={[styles.collagePiece, { top: pos.top, left: pos.left }]}>
                      <ItemThumb item={shown[idx]} size={pos.thumbSize} noBorder />
                    </View>
                  ))
                ) : (
                  <ItemThumb item={shown[0] ?? null} size={150} noBorder />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.nameRow}
                onPress={() => setRenaming({ id: item.id, name: item.name ?? '' })}
                hitSlop={{ top: 4, bottom: 4, left: 0, right: 4 }}
              >
                <Text style={styles.outfitName} numberOfLines={1}>{item.name ?? 'Untitled outfit'}</Text>
                <FigmaIcon name="edit" size={10} color={colors.inkMuted} />
              </TouchableOpacity>
              <View style={styles.metaRow}>
                <Text style={styles.outfitMeta}>{item.itemIds?.length ?? 0} pieces</Text>
                {item.rating != null && <Text style={styles.outfitRating}>★ {item.rating}</Text>}
              </View>
              {item.aesthetic ? (
                <View style={styles.aestheticBadge}>
                  <Ionicons name="sparkles" size={9} color={colors.ink} />
                  <Text style={styles.aestheticBadgeText}> {item.aesthetic.replace(/_/g, ' ')}</Text>
                </View>
              ) : null}
              {item.brand ? <Text style={styles.outfitBrand}>{item.brand}{item.price ? ` · ₹${item.price}` : ''}</Text> : null}
            </View>
          );
        }}
      />

      <Modal visible={!!renaming} transparent animationType="fade" onRequestClose={() => setRenaming(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Name this outfit</Text>
            <TextInput
              style={styles.modalInput}
              value={renaming?.name ?? ''}
              onChangeText={(t) => setRenaming((prev) => (prev ? { ...prev, name: t } : prev))}
              placeholder="e.g. Friday date night"
              placeholderTextColor={colors.inkMuted}
              autoFocus
              maxLength={60}
              onSubmitEditing={handleSaveName}
              returnKeyType="done"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setRenaming(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleSaveName} disabled={savingName}>
                <Text style={styles.modalSaveText}>{savingName ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <FilterPanel
        visible={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        onApply={setFilters}
        initial={filters}
        seasons={SEASONS}
        colors={colorOptions}
        styles_={categories}
        aesthetics={aestheticOptions}
        showRating
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, rowGap: spacing.sm,
  },
  title: { ...type.h1 },
  filterButton: { backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, width: 34, height: 34, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  filterButtonText: { fontSize: 12, color: colors.ink },
  packButton: { backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center' },
  packButtonText: { fontWeight: '600', fontSize: 12, color: colors.ink },
  addButton: { backgroundColor: colors.black, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' },
  addButtonText: { color: colors.white, fontWeight: '600', fontSize: 12 },
  packingHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  packingSectionTitle: { ...type.h3 },
  packingViewAll: { fontSize: 12, color: colors.inkMuted },
  packingCard: { width: 130, backgroundColor: colors.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  packingCoverWrap: { width: '100%', height: 145, borderRadius: radius.sm, overflow: 'hidden' },
  packingCoverPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  packingCardName: { fontSize: 12, fontWeight: '700', color: colors.ink, marginTop: spacing.xs },
  packingCardDates: { fontSize: 10, color: colors.inkMuted, marginTop: 1 },
  packingCardCount: { fontSize: 10, color: colors.success, fontWeight: '600', marginTop: 2 },
  tabList: { flexGrow: 0, maxHeight: 52, marginBottom: spacing.sm },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.inkMuted, paddingHorizontal: spacing.lg, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  tabRow: {
    paddingHorizontal: 6, paddingVertical: 6, gap: spacing.xs, alignItems: 'center',
    backgroundColor: colors.bgSoft, marginHorizontal: spacing.lg, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border,
  },
  tab: { paddingVertical: 5, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: 'transparent', marginRight: 2 },
  tabActive: { backgroundColor: colors.black },
  tabText: { fontSize: 12, color: colors.ink, textTransform: 'capitalize' },
  tabTextActive: { color: colors.white, fontWeight: '700' },
  card: { flex: 1, backgroundColor: colors.cream, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', position: 'relative' },
  deleteButton: {
    position: 'absolute', top: 6, right: 6, zIndex: 2, width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  deleteButtonText: { color: colors.white, fontSize: 13, fontWeight: '700', lineHeight: 14 },
  newBadge: {
    position: 'absolute', top: 6, right: 40, zIndex: 3, backgroundColor: colors.lavenderDeep ?? '#7C6BAF',
    borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3,
  },
  newBadgeText: { color: colors.white, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  shareButton: {
    position: 'absolute', top: 6, left: 6, zIndex: 2, width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  shareButtonText: { color: colors.white, fontSize: 14, fontWeight: '700', lineHeight: 15 },
  collageWrap: { width: 150, height: 150 * 1.25, position: 'relative', overflow: 'hidden', borderRadius: radius.md },
  collagePiece: { position: 'absolute' },
  nameRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: spacing.xs, gap: 4 },
  outfitName: { ...type.h3, maxWidth: 118 },
  editIcon: { fontSize: 11, color: colors.inkMuted },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 2 },
  outfitMeta: { ...type.muted, textTransform: 'capitalize' },
  outfitRating: { fontSize: 11, color: colors.warning, fontWeight: '600' },
  outfitBrand: { ...type.muted, alignSelf: 'flex-start', marginTop: 2 },
  aestheticBadge: { backgroundColor: colors.lavender, borderRadius: radius.pill, paddingVertical: 2, paddingHorizontal: 8, alignSelf: 'flex-start', marginTop: 4, flexDirection: 'row', alignItems: 'center' },
  aestheticBadgeText: { fontSize: 10, fontWeight: '700', color: colors.ink, textTransform: 'capitalize' },
  empty: { ...type.muted, textAlign: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg },
  modalTitle: { ...type.h3, marginBottom: spacing.sm },
  modalInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md,
    paddingVertical: 10, fontSize: 14, color: colors.ink, backgroundColor: colors.bgSoft,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  modalCancel: { paddingVertical: 10, paddingHorizontal: spacing.md },
  modalCancelText: { color: colors.inkMuted, fontWeight: '600', fontSize: 13 },
  modalSave: { backgroundColor: colors.black, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: spacing.md },
  modalSaveText: { color: colors.white, fontWeight: '600', fontSize: 13 },
  });
}
