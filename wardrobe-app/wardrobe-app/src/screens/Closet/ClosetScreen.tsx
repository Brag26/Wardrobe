import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, TextInput, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { FigmaIcon } from '../../components/icons/FigmaIcon';
import { getWardrobeItems, setItemFavorite, getClosetOverview, getAttributeSuggestions } from '../../api/wardrobeApi';
import { ItemThumb } from '../../components/ItemThumb';
import { FabMenu } from '../../components/FabMenu';
import { BuildWardrobeIllustration } from '../../components/illustrations/EmptyStateIllustrations';
import { FilterPanel, FilterValues } from '../../components/FilterPanel';
import { PageHeader } from '../../components/PageHeader';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';
import { AppIcon } from '../../components/icons/AppIcons';

// Tabs are now driven by whatever categories actually exist in THIS
// user's closet (via closet/overview's itemsByCategory breakdown),
// instead of a fixed 7-entry list — previously "Top"/"Bottom"/"Dress"/
// "Shoes"/"Bag"/"Accessory" were the only tabs no matter how varied
// someone's wardrobe was, so a closet full of kurtis, sarees, and
// joggers had nowhere to go but "Top"/"Bottom"/"Other". Falls back to
// this short list before the real breakdown loads.
const FALLBACK_TABS = ['All', 'Top', 'Bottom', 'Dress', 'Shoes', 'Bag', 'Accessory'];
const SEASONS = ['summer', 'autumn', 'winter', 'monsoon', 'spring', 'all_season'];

export default function ClosetScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  // QA: the favourite heart was floating at the far right of the card, away
  // from the photo, because the photo was a fixed 140px wide inside a wider
  // card. Size the photo to the real card width instead (screen width minus
  // the 24px side padding on each side and the 8px gap, split in two), so the
  // heart lands on the photo's top-right corner.
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.floor((screenWidth - spacing.lg * 2 - spacing.sm) / 2);

  const [items, setItems] = useState<any[]>([]);
  const [category, setCategory] = useState(route.params?.initialCategory ?? 'All');
  const [refreshing, setRefreshing] = useState(false);
  const [tabs, setTabs] = useState<string[]>(FALLBACK_TABS);
  const [filters, setFilters] = useState<FilterValues>({});
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [colorOptions, setColorOptions] = useState<string[]>(['black', 'white', 'red', 'blue', 'green', 'pink', 'beige', 'navy']);
  const [styleOptions, setStyleOptions] = useState<string[]>(['casual', 'formal', 'business', 'evening_wear', 'sport']);
  const [searchText, setSearchText] = useState('');

  React.useEffect(() => {
    getClosetOverview().then((overview) => {
      const present = Object.keys(overview.itemsByCategory ?? {}).sort();
      if (present.length > 0) {
        setTabs(['All', ...present.map((c) => c.replace(/_/g, ' '))]);
      }
    }).catch(() => {});
    getAttributeSuggestions().then((s) => { setColorOptions(s.colors); setStyleOptions(s.styles); }).catch(() => {});
  }, [items.length]);

  // Previously: (1) no loading state at all, meaning the FlatList's
  // empty-state message ("No items yet") would show during the
  // initial fetch too, since `items` starts as [] before the first
  // real response arrives — a person with a full closet would see
  // "No items yet" for however long the fetch takes (on a cold
  // backend, that's been measured at 30-60+ seconds elsewhere in this
  // app), which reads as data loss, not loading. (2) `catch {}`
  // silently swallowed any real error with zero trace — same pattern
  // found and fixed repeatedly elsewhere this session.
  const [closetLoading, setClosetLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const load = useCallback(async (cat: string, activeFilters: FilterValues, search: string) => {
    setClosetLoading(true);
    try {
      const params: Record<string, string | string[]> = {};
      if (cat !== 'All') params.category = cat.toLowerCase().replace(/ /g, '_');
      if (activeFilters.season) params.season = activeFilters.season;
      if (activeFilters.colors && activeFilters.colors.length > 0) params.color = activeFilters.colors;
      if (activeFilters.style) params.style = activeFilters.style;
      if (search.trim()) params.search = search.trim();
      const data = await getWardrobeItems(params);
      setItems(data);
    } catch (e: any) {
      console.error('[ClosetScreen] load failed:', e);
    } finally {
      setClosetLoading(false);
      setHasLoadedOnce(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(category, filters, searchText); }, [category, filters, searchText, load]));

  // Debounced — searching on every keystroke would fire a network
  // request per character typed. 400ms after the person stops typing
  // is enough to feel instant without hammering the API.
  React.useEffect(() => {
    const timeout = setTimeout(() => { load(category, filters, searchText); }, 400);
    return () => clearTimeout(timeout);
  }, [searchText]);

  const onRefresh = async () => { setRefreshing(true); await load(category, filters, searchText); setRefreshing(false); };
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // QA (regressed once already — re-applying): "Browse by category"
  // taps sometimes did nothing visible — the request to the server DID
  // go out (load() above already builds params.category), but a slow
  // or errored refetch left the OLD unfiltered items on screen with no
  // sign anything happened. This filters what's actually rendered
  // client-side too, so tapping a category is never dependent on the
  // network round trip finishing to show *something* changed.
  const displayedItems = React.useMemo(() => {
    if (category === 'All') return items;
    const target = category.toLowerCase().replace(/ /g, '_');
    return items.filter((i) => i.category === target || i.category?.startsWith(`${target}_`));
  }, [items, category]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageHeader title="Closet" />
      <View style={styles.header}>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setFilterPanelOpen(true)}>
            <FigmaIcon name="filter" size={16} color={colors.ink} />
            {activeFilterCount > 0 && <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeFilterCount}</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Archive')}>
            <AppIcon name="fileTray" size={16} color={colors.ink} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Favorites')}>
            <FigmaIcon name="heartOutline" size={16} color={colors.ink} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Bin')}>
            <FigmaIcon name="trash" size={16} color={colors.ink} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBar}>
        <AppIcon name="search" size={16} color={colors.inkMuted} />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search your closet…"
          placeholderTextColor={colors.inkMuted}
          returnKeyType="search"
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FigmaIcon name="close" size={14} color={colors.inkMuted} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionLabel}>Browse by category</Text>
      <FlatList
        horizontal
        data={tabs}
        keyExtractor={(c) => c}
        showsHorizontalScrollIndicator={false}
        style={styles.tabList}
        contentContainerStyle={styles.tabRow}
        renderItem={({ item: c }) => (
          <TouchableOpacity onPress={() => setCategory(c)} style={[styles.tab, category === c && styles.tabActive]}>
            <Text style={[styles.tabText, category === c && styles.tabTextActive]}>{c}</Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={displayedItems}
        keyExtractor={(i) => i.id}
        numColumns={2}
        style={{ flex: 1 }}
        columnWrapperStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          closetLoading && !hasLoadedOnce ? (
            <View style={{ paddingTop: spacing.xxl, alignItems: 'center' }}>
              <ActivityIndicator color={colors.inkMuted} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateImage}><BuildWardrobeIllustration /></View>
              <Text style={styles.empty}>No items yet — tap Add items below.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { width: cardWidth }]}
            onPress={() => {
              // QA (regressed once already — re-applying): native-stack
              // keeps ClosetScreen mounted underneath ItemDetails, so a
              // leftover search query survived the round trip — and once
              // back, further typing into that stale query stopped
              // matching anything sensible. Clear it going in.
              setSearchText('');
              navigation.navigate('ItemDetails', { itemId: item.id });
            }}
          >
            <View style={styles.thumbWrap}>
              <ItemThumb item={item} size={cardWidth} />
              <TouchableOpacity
                style={styles.favButton}
                onPress={() => {
                  // Bug: this waited on setItemFavorite's network call,
                  // then re-fetched and replaced the entire list before
                  // the heart updated — a real 1-2s lag on every tap.
                  // Flip it in the list immediately; the API call still
                  // happens, just without blocking what you see.
                  setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isFavorite: !item.isFavorite } : i)));
                  setItemFavorite(item.id, !item.isFavorite).catch(() => {
                    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isFavorite: item.isFavorite } : i)));
                  });
                }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <FigmaIcon name={item.isFavorite ? 'heart' : 'heartOutline'} size={15} color={item.isFavorite ? colors.heart : colors.ink} />
              </TouchableOpacity>
            </View>
            <Text style={styles.itemName} numberOfLines={1}>{item.color} {item.category}</Text>
            {item.brand ? <Text style={styles.itemBrand}>{item.brand}</Text> : null}
          </TouchableOpacity>
        )}
      />

      {/* Was a single "Add items" bar — bulk upload existed but was
          buried two taps deep inside that flow. A small menu here
          surfaces both without adding a new screen. */}
      <FabMenu
        actions={[
          { label: 'Add items', icon: 'shirt', onPress: () => navigation.navigate('AddItem') },
          { label: 'Bulk upload', icon: 'image', onPress: () => navigation.navigate('BulkUpload') },
        ]}
      />

      <FilterPanel
        visible={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        onApply={setFilters}
        initial={filters}
        seasons={SEASONS}
        colors={colorOptions}
        styles_={styleOptions}
        showRating={false}
        multiColor
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    // Bug: no gap at all between this row and the search bar below it —
    // they visually touched/overlapped on some devices.
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
    title: { ...type.h1 },
    iconButton: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    filterBadge: { position: 'absolute', top: -3, right: -3, backgroundColor: colors.black, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
    filterBadgeText: { color: colors.white, fontSize: 9, fontWeight: '700' },
    // Pill background lives on the list itself (not its content container),
    // so the last chip can always be scrolled fully into view on Android.
    tabList: {
      flexGrow: 0, maxHeight: 52, marginBottom: spacing.sm,
      marginHorizontal: spacing.lg, backgroundColor: colors.bgSoft, borderRadius: radius.pill,
      borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },
    // Wrapped in a capsule/track background (segmented-control look)
    // so the whole row reads as one grouped control, not a loose
    // scatter of floating pills — plus a small label above it, since
    // previously there was no header at all indicating what this row
    // of tabs was for.
    searchBar: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border,
      borderRadius: radius.pill, marginHorizontal: spacing.lg, marginBottom: spacing.md, paddingHorizontal: spacing.md, height: 42,
    },
    searchInput: { flex: 1, fontSize: 14, color: colors.ink, paddingVertical: 0 },
    sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.inkMuted, paddingHorizontal: spacing.lg, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
    tabRow: { paddingHorizontal: 6, paddingVertical: 6, gap: spacing.xs, alignItems: 'center' },
    tab: { paddingVertical: 5, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: 'transparent', marginRight: 2 },
    tabActive: { backgroundColor: colors.card ?? colors.bg, borderWidth: 1, borderColor: colors.lavenderDeep },
    tabText: { fontSize: 12, color: colors.ink },
    tabTextActive: { fontWeight: '700' },
    card: {},
    thumbWrap: { position: 'relative', width: '100%' },
    // Bug: a 90%-opaque white circle on top of a real photo still let
    // the photo's own colors/edges show faintly through it, and the
    // heart itself was the same flat grey whether favorited or not —
    // together that's why it read as "coming out of the image" rather
    // than sitting cleanly on top. Fully opaque now, with a real drop
    // shadow to lift it off the photo, and the heart itself switches
    // to a solid pink when favorited instead of staying grey.
    favButton: {
      position: 'absolute', top: spacing.xs, right: spacing.xs, width: 26, height: 26, borderRadius: 13,
      backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.18, shadowRadius: 3, elevation: 3,
    },
    itemName: { fontSize: 12, fontWeight: '600', color: colors.ink, marginTop: spacing.xs, textTransform: 'capitalize' },
    itemBrand: { fontSize: 10, color: colors.inkMuted },
    empty: { ...type.muted, textAlign: 'center', paddingHorizontal: spacing.lg },
    emptyState: { alignItems: 'center', marginTop: spacing.xl },
    emptyStateImage: { height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
    addButton: {
      position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg,
      backgroundColor: colors.black, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center',
      flexDirection: 'row', justifyContent: 'center', gap: 6,
    },
    addButtonText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  });
}
