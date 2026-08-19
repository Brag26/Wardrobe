import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FigmaIcon } from '../../components/icons/FigmaIcon';
import { listOutfits, getOutfitCategories, getItemsByIds, deleteOutfit, updateOutfit, listPackings, getAttributeSuggestions } from '../../api/wardrobeApi';
import { ItemThumb } from '../../components/ItemThumb';
import { FilterPanel, FilterValues } from '../../components/FilterPanel';
import { colors, spacing, type, radius } from '../../theme/theme';

const SEASONS = ['summer', 'autumn', 'winter', 'monsoon', 'spring', 'all_season'];

export default function OutfitsScreen() {
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

  const load = useCallback(async (cat: string, activeFilters: FilterValues) => {
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
    } catch {}
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
      <View style={styles.header}>
        <Text style={styles.title}>My Outfits</Text>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
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
        ListEmptyComponent={<Text style={styles.empty}>No outfits in this category yet.</Text>}
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
          const shown = pieces.slice(0, 4);
          const overflow = pieces.length - shown.length;
          return (
            <View style={styles.card}>
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
                <FigmaIcon name="close" size={13} color={colors.white} />
              </TouchableOpacity>

              {/* Whole outfit, not just one piece: a small grid of every
                  item's thumbnail (up to 4, "+N" for the rest). Falls
                  back to the single-thumb layout for a 1-piece outfit.
                  Tapping the pieces opens Edit outfit — previously
                  there was no way to change WHICH items were in an
                  outfit after creating it, only rename or delete it. */}
              <TouchableOpacity onPress={() => navigation.navigate('CreateOutfit', { editOutfitId: item.id })} activeOpacity={0.85}>
                {shown.length > 1 ? (
                  <View style={styles.piecesGrid}>
                    {shown.map((piece: any, idx: number) => (
                      <View key={idx} style={styles.pieceSlot}>
                        <ItemThumb item={piece} size={67} />
                      </View>
                    ))}
                    {overflow > 0 && (
                      <View style={[styles.pieceSlot, styles.overflowSlot]}>
                        <Text style={styles.overflowText}>+{overflow}</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <ItemThumb item={shown[0] ?? null} size={150} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
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
  card: { flex: 1, backgroundColor: colors.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, alignItems: 'center', position: 'relative' },
  deleteButton: {
    position: 'absolute', top: 6, right: 6, zIndex: 2, width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  deleteButtonText: { color: colors.white, fontSize: 13, fontWeight: '700', lineHeight: 14 },
  shareButton: {
    position: 'absolute', top: 6, left: 6, zIndex: 2, width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  shareButtonText: { color: colors.white, fontSize: 14, fontWeight: '700', lineHeight: 15 },
  piecesGrid: { width: 150, height: 150 * 1.25, flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignContent: 'flex-start' },
  pieceSlot: { width: 71, height: 71 },
  overflowSlot: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  overflowText: { ...type.h3 },
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
