import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FigmaIcon } from '../../components/icons/FigmaIcon';
import { getWardrobeItems, setItemFavorite, getClosetOverview, getAttributeSuggestions } from '../../api/wardrobeApi';
import { ItemThumb } from '../../components/ItemThumb';
import { FilterPanel, FilterValues } from '../../components/FilterPanel';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

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

  const load = useCallback(async (cat: string, activeFilters: FilterValues, search: string) => {
    try {
      const params: Record<string, string> = {};
      if (cat !== 'All') params.category = cat.toLowerCase().replace(/ /g, '_');
      if (activeFilters.season) params.season = activeFilters.season;
      if (activeFilters.color) params.color = activeFilters.color;
      if (activeFilters.style) params.style = activeFilters.style;
      if (search.trim()) params.search = search.trim();
      const data = await getWardrobeItems(params);
      setItems(data);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(category, filters, searchText); }, [category, filters, load]));

  // Debounced — searching on every keystroke would fire a network
  // request per character typed. 400ms after the person stops typing
  // is enough to feel instant without hammering the API.
  React.useEffect(() => {
    const timeout = setTimeout(() => { load(category, filters, searchText); }, 400);
    return () => clearTimeout(timeout);
  }, [searchText]);

  const onRefresh = async () => { setRefreshing(true); await load(category, filters, searchText); setRefreshing(false); };
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Closet</Text>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setFilterPanelOpen(true)}>
            <FigmaIcon name="filter" size={16} color={colors.ink} />
            {activeFilterCount > 0 && <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeFilterCount}</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('ReorderItems')}>
            <Ionicons name="swap-vertical-outline" size={16} color={colors.ink} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Archive')}>
            <Ionicons name="file-tray-full-outline" size={16} color={colors.ink} />
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
        <Ionicons name="search-outline" size={16} color={colors.inkMuted} style={{ marginRight: 6 }} />
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
        data={items}
        keyExtractor={(i) => i.id}
        numColumns={2}
        style={{ flex: 1 }}
        columnWrapperStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>No items yet — tap Add items below.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ItemDetails', { itemId: item.id })}>
            <View style={styles.thumbWrap}>
              <ItemThumb item={item} size={140} />
              <TouchableOpacity
                style={styles.favButton}
                onPress={() => { setItemFavorite(item.id, !item.isFavorite); load(category, filters, searchText); }}
              >
                <FigmaIcon name={item.isFavorite ? 'heart' : 'heartOutline'} size={16} color={colors.inkMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.itemName} numberOfLines={1}>{item.color} {item.category}</Text>
            {item.brand ? <Text style={styles.itemBrand}>{item.brand}</Text> : null}
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddItem')}>
        <FigmaIcon name="add" size={16} color={colors.white} />
        <Text style={styles.addButtonText}>Add items</Text>
      </TouchableOpacity>

      <FilterPanel
        visible={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        onApply={setFilters}
        initial={filters}
        seasons={SEASONS}
        colors={colorOptions}
        styles_={styleOptions}
        showRating={false}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    title: { ...type.h1 },
    iconButton: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    filterBadge: { position: 'absolute', top: -3, right: -3, backgroundColor: colors.black, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
    filterBadgeText: { color: colors.white, fontSize: 9, fontWeight: '700' },
    tabList: { flexGrow: 0, maxHeight: 52, marginBottom: spacing.sm },
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
    tabRow: {
      paddingHorizontal: 6, paddingVertical: 6, gap: spacing.xs, alignItems: 'center',
      backgroundColor: colors.bgSoft, marginHorizontal: spacing.lg, borderRadius: radius.pill,
      borderWidth: 1, borderColor: colors.border,
    },
    tab: { paddingVertical: 5, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: 'transparent', marginRight: 2 },
    tabActive: { backgroundColor: colors.card ?? colors.bg, borderWidth: 1, borderColor: colors.lavenderDeep },
    tabText: { fontSize: 12, color: colors.ink },
    tabTextActive: { fontWeight: '700' },
    card: { flex: 1 },
    thumbWrap: { position: 'relative', width: '100%' },
    favButton: {
      position: 'absolute', top: spacing.xs, right: spacing.xs, width: 28, height: 28, borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
    },
    itemName: { fontSize: 12, fontWeight: '600', color: colors.ink, marginTop: spacing.xs, textTransform: 'capitalize' },
    itemBrand: { fontSize: 10, color: colors.inkMuted },
    empty: { ...type.muted, textAlign: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
    addButton: {
      position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg,
      backgroundColor: colors.black, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center',
      flexDirection: 'row', justifyContent: 'center', gap: 6,
    },
    addButtonText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  });
}
