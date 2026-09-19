import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, FlatList, Switch, Animated, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FigmaIcon } from '../../components/icons/FigmaIcon';
import { getClosetOverview, getWardrobeItems, listOutfits, setItemFavorite, getItemsByIds, getTodayOutfit } from '../../api/wardrobeApi';
import { useAuthStore } from '../../store/authStore';
import { ItemThumb } from '../../components/ItemThumb';
import { AraMascot } from '../../components/AraMascot';
import { spacing, radius, cardShadow, COLOR_SWATCHES } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

const OUTFIT_TABS = ['All', 'Casual', 'Formal', 'Business', 'Evening Wear'];
const FALLBACK_ITEM_TABS = ['All', 'Top', 'Bottom', 'Dress', 'Shoes'];

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const signOut = useAuthStore((s) => s.signOut);
  const { colors, type, isDark, toggleTheme } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);

  const [overview, setOverview] = useState<any>(null);
  const [outfits, setOutfits] = useState<any[]>([]);
  const [outfitPreviews, setOutfitPreviews] = useState<Record<string, any>>({});
  const [items, setItems] = useState<any[]>([]);
  const [outfitTab, setOutfitTab] = useState('All');
  const [itemTab, setItemTab] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const fabAnim = React.useRef(new Animated.Value(0)).current;

  // "Outfit of the Day" — single-tap generate/reveal on the banner
  // below, with the banner's own background color set to match the
  // outfit's dominant color once it's loaded (falls back to the
  // default black banner before that, and if a color has no match in
  // COLOR_SWATCHES for some reason).
  const [todayOutfit, setTodayOutfit] = useState<any>(null);
  const [todayItems, setTodayItems] = useState<any[]>([]);
  const [ootdLoading, setOotdLoading] = useState(false);
  const [ootdMessage, setOotdMessage] = useState<string | null>(null);

  const loadTodayOutfit = async () => {
    setOotdLoading(true);
    setOotdMessage(null);
    try {
      const result = await getTodayOutfit();
      if (result.outfit) {
        setTodayOutfit(result.outfit);
        setTodayItems(result.items ?? []);
      } else {
        setOotdMessage(result.message ?? "Couldn't generate an outfit right now.");
      }
    } catch (e: any) {
      // Previously this swallowed the real error entirely — same
      // silent-failure pattern found (and fixed) in aiStylist.service.ts
      // earlier, recurring here in new code. Logging it now so a real
      // failure shows up in the dev console instead of just "nothing
      // happened" with zero trace of why.
      console.error('[HomeScreen] getTodayOutfit failed:', e);
      setOotdMessage(e?.message ? `Couldn't load today's outfit: ${e.message}` : "Couldn't load today's outfit — try again in a bit.");
    } finally {
      setOotdLoading(false);
    }
  };

  // Dominant color = whichever color appears most often across the
  // outfit's actual items — a simple, honest heuristic (not claiming
  // deep color-theory analysis, just "what color shows up most").
  const dominantColorHex = React.useMemo(() => {
    if (todayItems.length === 0) return null;
    const counts: Record<string, number> = {};
    todayItems.forEach((i) => { if (i.color) counts[i.color] = (counts[i.color] ?? 0) + 1; });
    const topColor = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return topColor ? COLOR_SWATCHES[topColor] ?? null : null;
  }, [todayItems]);

  const toggleFab = () => {
    Animated.spring(fabAnim, { toValue: fabOpen ? 0 : 1, useNativeDriver: true, friction: 7 }).start();
    setFabOpen((v) => !v);
  };

  const fabActions = [
    { label: 'Add items', icon: 'shirt-outline' as const, onPress: () => navigation.navigate('ClosetTab', { screen: 'AddItem' }) },
    { label: 'Add outfit', icon: 'sparkles-outline' as const, onPress: () => navigation.navigate('OutfitsTab', { screen: 'CreateOutfit' }) },
    { label: 'Schedule outfit', icon: 'calendar-outline' as const, onPress: () => navigation.navigate('CalendarStack') },
    { label: 'Plan trip outfits', icon: 'briefcase-outline' as const, onPress: () => navigation.navigate('OutfitsTab', { screen: 'StartPacking' }) },
  ];

  // Previously this swallowed errors completely (`catch {}`) — the
  // same silent-failure pattern found and fixed repeatedly elsewhere
  // this session. If the backend was slow to respond (a cold Render
  // instance waking up can take 30-60+ seconds after being idle), the
  // screen just sat there empty with zero explanation and zero trace
  // of why. Now logs the real error AND shows an honest, elapsed-
  // time-aware message if it's taking a while, instead of looking
  // broken with no signal that anything's happening.
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeLoadElapsed, setHomeLoadElapsed] = useState(0);

  const load = useCallback(async () => {
    setHomeLoading(true);
    const startedAt = Date.now();
    const tick = setInterval(() => setHomeLoadElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    try {
      const [ov, out, its] = await Promise.all([
        getClosetOverview(),
        listOutfits(outfitTab === 'All' ? 'all' : outfitTab.toLowerCase().replace(' ', '_')),
        getWardrobeItems(itemTab === 'All' ? {} : { category: itemTab.toLowerCase().replace(/ /g, '_') }),
      ]);
      setOverview(ov);
      setOutfits(out);
      setItems(its);

      const firstIds = out.map((o: any) => o.itemIds?.[0]).filter(Boolean);
      if (firstIds.length > 0) {
        const resolved = await getItemsByIds([...new Set(firstIds)] as string[]);
        const map: Record<string, any> = {};
        resolved.forEach((item: any) => { map[item.id] = item; });
        setOutfitPreviews(map);
      }
    } catch (e: any) {
      console.error('[HomeScreen] load failed:', e);
    } finally {
      clearInterval(tick);
      setHomeLoadElapsed(0);
      setHomeLoading(false);
    }
  }, [outfitTab, itemTab]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const categoryCount = overview?.itemsByCategory ? Object.keys(overview.itemsByCategory).length : null;
  // Same as ClosetScreen: real categories from this user's closet
  // (via overview.itemsByCategory) instead of a fixed 4-entry list, so
  // the Home tabs stay in sync with whatever's actually in their closet.
  const itemTabs = overview?.itemsByCategory && Object.keys(overview.itemsByCategory).length > 0
    ? ['All', ...Object.keys(overview.itemsByCategory).sort().map((c) => c.replace(/_/g, ' '))]
    : FALLBACK_ITEM_TABS;

  // "Browse by category" (Home board): the categories actually present
  // in this closet, sorted by how many items are in each, so the most
  // relevant ones show first rather than an exhaustive alphabetical
  // dump of all ~150 possible categories.
  const browseCategories = overview?.itemsByCategory
    ? Object.entries(overview.itemsByCategory).sort((a: any, b: any) => b[1] - a[1]).slice(0, 10)
    : [];
  // Full-bleed category cards need a real cover photo per category —
  // previously these cards had no photo at all (just an icon + text
  // in a bordered box). Uses the first actual item in each category
  // as its cover, so it's a real photo from the person's own closet,
  // not a placeholder or stock image.
  const categoryCoverItem = React.useMemo(() => {
    const map: Record<string, any> = {};
    items.forEach((i) => { if (i.category && !map[i.category]) map[i.category] = i; });
    return map;
  }, [items]);
  // "Uncategorized" (Home board): items whose category is missing or
  // empty — category is required at creation time, so this is mainly
  // a safety net for imported/legacy data rather than a common bucket,
  // but the section only renders when it's non-empty.
  const uncategorizedItems = items.filter((i) => !i.category);

  const isEmptyCloset = overview && overview.totalItems === 0;

  if (isEmptyCloset) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.emptyWrap}>
          <Text style={{ fontSize: 64 }}>👗</Text>
          <Text style={[type.h1, { marginTop: spacing.md, textAlign: 'center' }]}>Build your closet</Text>
          <Text style={[type.muted, { textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.lg }]}>
            Upload the clothes you love and create your personal wardrobe — Ara does the rest.
          </Text>
          <View style={{ height: spacing.lg }} />
          <TouchableOpacity style={styles.emptyCta} onPress={() => navigation.navigate('ClosetTab', { screen: 'AddItem' })}>
            <Text style={styles.emptyCtaText}>+ Add items</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {homeLoading && homeLoadElapsed > 4 && (
        <View style={styles.coldStartBanner}>
          <Text style={styles.coldStartBannerText}>
            {homeLoadElapsed > 20
              ? "Still waking things up — the server's coming online after being idle, hang tight…"
              : 'Loading your closet…'}
          </Text>
        </View>
      )}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.topRow}>
          <Text style={styles.greeting}>Good morning</Text>
          <View style={styles.darkModeRow}>
            <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate('CalendarStack')}>
              <Ionicons name="calendar-outline" size={16} color={colors.ink} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate('Profile', { screen: 'StyleProfileHub' })}>
              <Ionicons name="person-outline" size={16} color={colors.ink} />
            </TouchableOpacity>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={16} color={colors.ink} style={{ marginRight: 2 }} />
            <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: colors.border, true: colors.lavenderDeep }} />
          </View>
        </View>

        <TouchableOpacity
          style={styles.araBanner}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('AraTab')}
          onLongPress={() => navigation.navigate('Advanced', { screen: 'AdvancedHub' })}
          delayLongPress={1200}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.araBannerLabel}>ARA MIX & MATCH</Text>
            <Text style={styles.araBannerTitle}>AI curated, just for you</Text>
            <View style={styles.araBannerButton}>
              <Text style={styles.araBannerButtonText}>Try Ara →</Text>
            </View>
          </View>
          <View style={styles.araBannerPreview}>
            <AraMascot size={72} onDarkBackground />
          </View>
        </TouchableOpacity>

        {/* "Outfit of the Day" — single tap generates/reveals today's
            pick (same one persists all day once generated, doesn't
            re-roll on every tap). Background color matches whichever
            color shows up most across the outfit's actual items,
            falling back to the default dark banner before that's
            loaded or if the color has no swatch match. */}
        <TouchableOpacity
          style={[styles.ootdBanner, dominantColorHex ? { backgroundColor: dominantColorHex } : null]}
          activeOpacity={0.9}
          onPress={() => (todayOutfit ? navigation.navigate('OutfitsTab', { screen: 'OutfitDetail', params: { outfitId: todayOutfit.id } }) : loadTodayOutfit())}
          disabled={ootdLoading}
        >
          {ootdLoading ? (
            <Text style={styles.ootdLoadingText}>Putting today's look together…</Text>
          ) : todayOutfit ? (
            <>
              <View style={{ flex: 1 }}>
                <Text style={styles.ootdLabel}>OUTFIT OF THE DAY</Text>
                <Text style={styles.ootdTitle} numberOfLines={1}>{todayOutfit.name ?? 'Today\'s pick'}</Text>
                <Text style={styles.ootdSubtitle}>{todayItems.length} piece{todayItems.length === 1 ? '' : 's'} — tap to view in Outfits</Text>
              </View>
              <View style={styles.ootdPreviewRow}>
                {todayItems.slice(0, 3).map((it, idx) => (
                  <View key={it.id ?? idx} style={styles.ootdPreviewThumb}><ItemThumb item={it} size={52} /></View>
                ))}
              </View>
            </>
          ) : (
            <View style={{ flex: 1 }}>
              <Text style={styles.ootdLabel}>OUTFIT OF THE DAY</Text>
              <Text style={styles.ootdTitle}>{ootdMessage ?? 'Tap to see what to wear today'}</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Your Closet Overview</Text>
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Ionicons name="shirt-outline" size={20} color={colors.ink} />
            <Text style={styles.statNum}>{overview?.totalItems ?? '–'}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>Items</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="sparkles-outline" size={20} color={colors.ink} />
            <Text style={styles.statNum}>{overview?.totalOutfits ?? '–'}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>Outfits</Text>
          </View>
          <View style={styles.statCard}>
            <FigmaIcon name="heartOutline" size={20} color={colors.ink} />
            <Text style={styles.statNum}>{overview?.totalFavorites ?? '–'}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>Favorites</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="pricetag-outline" size={20} color={colors.ink} />
            <Text style={styles.statNum}>{categoryCount ?? '–'}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>Categories</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Outfits</Text>
          <TouchableOpacity onPress={() => navigation.navigate('OutfitsTab')}>
            <Text style={styles.viewAll}>View all</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          horizontal
          data={OUTFIT_TABS}
          keyExtractor={(t) => t}
          showsHorizontalScrollIndicator={false}
          style={styles.tabList}
          contentContainerStyle={styles.tabRow}
          renderItem={({ item: t }) => (
            <TouchableOpacity onPress={() => setOutfitTab(t)} style={[styles.tab, outfitTab === t && styles.tabActive]}>
              <Text style={[styles.tabText, outfitTab === t && styles.tabTextActive]}>{t}</Text>
            </TouchableOpacity>
          )}
        />
        {outfits.length === 0 ? (
          // Real illustrated empty state (client-provided asset), not
          // just a plain "No outfits yet" line — previously this
          // section gave a first-time user almost nothing to look at.
          <View style={styles.emptyStateCard}>
            <Image source={require('../../../assets/illustrations/create-outfit.jpg')} style={styles.emptyStateImage} resizeMode="contain" />
            <Text style={styles.emptyStateTitle}>Create your first look</Text>
            <Text style={styles.emptyStateBody}>Put together outfits you love and save them for whenever you need a little style inspiration.</Text>
            <TouchableOpacity style={styles.emptyStateButton} onPress={() => navigation.navigate('OutfitsTab', { screen: 'CreateOutfit' })}>
              <Text style={styles.emptyStateButtonText}>Create outfit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            horizontal
            data={outfits}
            keyExtractor={(o) => o.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.outfitCard} onPress={() => navigation.navigate('OutfitsTab')}>
                <View style={styles.outfitThumbRow}>
                  <ItemThumb item={item.itemIds?.[0] ? outfitPreviews[item.itemIds[0]] ?? null : null} size={80} noBorder />
                </View>
                <Text style={styles.outfitName} numberOfLines={1}>{item.name ?? 'Outfit'}</Text>
                <View style={styles.outfitMetaRow}>
                  <Text style={styles.outfitMeta}>{item.brand ?? `${item.itemIds?.length ?? 0} pieces`}</Text>
                  {item.rating != null && <Text style={styles.outfitRating}>★ {item.rating}</Text>}
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Items</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ClosetTab')}>
            <Text style={styles.viewAll}>View all</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          horizontal
          data={itemTabs}
          keyExtractor={(t) => t}
          showsHorizontalScrollIndicator={false}
          style={styles.tabList}
          contentContainerStyle={styles.tabRow}
          renderItem={({ item: t }) => (
            <TouchableOpacity onPress={() => setItemTab(t)} style={[styles.tab, itemTab === t && styles.tabActive]}>
              <Text style={[styles.tabText, itemTab === t && styles.tabTextActive]}>{t}</Text>
            </TouchableOpacity>
          )}
        />
        {items.length === 0 ? (
          <View style={[styles.emptyStateCard, { marginBottom: spacing.lg }]}>
            <Image source={require('../../../assets/illustrations/build-wardrobe.jpg')} style={styles.emptyStateImage} resizeMode="contain" />
            <Text style={styles.emptyStateTitle}>Build Your Wardrobe</Text>
            <Text style={styles.emptyStateBody}>Add your clothes, shoes, bags, and accessories so everything you own is easy to find and style.</Text>
            <TouchableOpacity style={styles.emptyStateButton} onPress={() => navigation.navigate('ClosetTab', { screen: 'AddItem' })}>
              <Text style={styles.emptyStateButtonText}>Add Item</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            horizontal
            data={items}
            keyExtractor={(i) => i.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.lg }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.itemCard}
                onPress={() => navigation.navigate('ClosetTab', { screen: 'ItemDetails', params: { itemId: item.id } })}
              >
                <ItemThumb item={item} size={80} />
              <TouchableOpacity
                style={styles.itemHeart}
                onPress={() => { setItemFavorite(item.id, !item.isFavorite); load(); }}
              >
                <Text style={{ color: item.isFavorite ? colors.heart : colors.inkMuted }}>{item.isFavorite ? '♥' : '♡'}</Text>
              </TouchableOpacity>
              <Text style={styles.itemLabel} numberOfLines={1}>{item.color} {item.category}</Text>
            </TouchableOpacity>
          )}
          />
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Browse by category</Text>
        </View>
        <FlatList
          horizontal
          data={browseCategories}
          keyExtractor={([cat]: any) => cat}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm }}
          ListEmptyComponent={<Text style={styles.empty}>Add some items to see your categories here</Text>}
          renderItem={({ item: [cat, count] }: any) => {
            const cover = categoryCoverItem[cat];
            return (
              <TouchableOpacity
                style={styles.categoryCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('ClosetTab', { screen: 'ClosetHome', params: { initialCategory: cat } })}
              >
                {cover?.imageUrl ? (
                  <Image source={{ uri: cover.imageUrl }} style={styles.categoryCardImage} />
                ) : (
                  <View style={[styles.categoryCardImage, styles.categoryCardImageFallback]}>
                    <Ionicons name="pricetag-outline" size={22} color={colors.inkMuted} />
                  </View>
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.72)']}
                  style={styles.categoryCardScrim}
                />
                <View style={styles.categoryCardTextWrap}>
                  <Text style={styles.categoryCardLabel} numberOfLines={1}>{cat.replace(/_/g, ' ')}</Text>
                  <Text style={styles.categoryCardCount}>{count} item{count === 1 ? '' : 's'}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />

        {uncategorizedItems.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Uncategorized</Text>
            </View>
            <FlatList
              horizontal
              data={uncategorizedItems}
              keyExtractor={(i) => i.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.itemCard}
                  onPress={() => navigation.navigate('ClosetTab', { screen: 'ItemDetails', params: { itemId: item.id } })}
                >
                  <ItemThumb item={item} size={80} />
                  <Text style={styles.itemLabel} numberOfLines={1}>{item.color ?? 'Untitled item'}</Text>
                </TouchableOpacity>
              )}
            />
          </>
        )}

        <TouchableOpacity onPress={signOut} style={styles.signOutLink}>
          <Text style={styles.signOutText}>Sign out (dev)</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* FAB quick-action menu (Home board): tap to reveal Add items /
          Add outfit / Schedule outfit / Plan trip outfits, each just a
          shortcut into a flow that already exists elsewhere — this is
          purely a faster entry point, not new functionality. */}
      {fabOpen && (
        <View style={styles.fabBackdrop} pointerEvents="box-none">
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={toggleFab} />
        </View>
      )}
      <View style={styles.fabWrap} pointerEvents="box-none">
        {fabActions.map((action, idx) => {
          const translateY = fabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -(56 * (idx + 1))] });
          const opacity = fabAnim;
          return (
            <Animated.View key={action.label} style={[styles.fabAction, { transform: [{ translateY }], opacity }]} pointerEvents={fabOpen ? 'auto' : 'none'}>
              <Text style={styles.fabActionLabel}>{action.label}</Text>
              <TouchableOpacity
                style={styles.fabActionButton}
                onPress={() => { toggleFab(); action.onPress(); }}
              >
                <Ionicons name={action.icon} size={17} color={colors.ink} />
              </TouchableOpacity>
            </Animated.View>
          );
        })}
        <TouchableOpacity style={styles.fabMain} onPress={toggleFab} activeOpacity={0.85}>
          <Animated.Text style={[styles.fabMainIcon, { transform: [{ rotate: fabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }]}>+</Animated.Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    coldStartBanner: { backgroundColor: colors.cream, paddingVertical: 6, paddingHorizontal: spacing.lg },
    coldStartBannerText: { fontSize: 11, color: colors.inkMuted, textAlign: 'center' },
    scroll: { paddingBottom: spacing.xxl },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    greeting: { ...type.h1 },
    darkModeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    profileButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
    profileButtonIcon: { fontSize: 14 },
    darkModeLabel: { fontSize: 14 },
    araBanner: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.black, borderRadius: radius.lg, padding: spacing.md,
      marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.lg,
    },
    araBannerLabel: { color: colors.lavenderDeep, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
    araBannerTitle: { color: colors.white, fontSize: 16, fontWeight: '700', marginTop: 4, marginBottom: spacing.sm },
    araBannerButton: { backgroundColor: colors.white, borderRadius: radius.pill, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: spacing.md },
    araBannerButtonText: { fontSize: 11, fontWeight: '700', color: colors.black },
    araBannerPreview: { borderRadius: radius.md, overflow: 'hidden' },
    ootdBanner: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      // Deliberately a fixed dark value, NOT colors.black — colors.black
      // is intentionally INVERTED in dark mode (near-white, for button
      // styling: "light pill on dark background"). Reusing it here for
      // this banner's own background caused the exact opposite of what
      // was intended: in dark mode the banner flipped to near-white
      // while its white label text stayed white, making it nearly
      // invisible. This banner is always meant to be a dark surface
      // with light text (whether this default state, or once a real
      // outfit's dominant color loads) — fixed value keeps that
      // correct in both themes.
      backgroundColor: '#1A1712', borderRadius: radius.lg, padding: spacing.md,
      marginHorizontal: spacing.lg, marginBottom: spacing.lg, minHeight: 76,
    },
    ootdLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
    ootdTitle: { color: colors.white, fontSize: 15, fontWeight: '700', marginTop: 4 },
    ootdSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
    ootdLoadingText: { color: colors.white, fontSize: 13, fontWeight: '600' },
    ootdPreviewRow: { flexDirection: 'row' },
    ootdPreviewThumb: { marginLeft: -10, borderRadius: radius.sm, overflow: 'hidden', borderWidth: 2, borderColor: colors.white },
    sectionTitle: { ...type.h2, paddingHorizontal: spacing.lg },
    // Illustrated empty states — matches the client reference exactly:
    // white card, illustration, bold title, muted description, full-
    // width black pill button. cardShadow gives it real elevation
    // instead of just a flat border.
    emptyStateCard: {
      backgroundColor: colors.card, borderRadius: radius.lg, marginHorizontal: spacing.lg,
      padding: spacing.xl, alignItems: 'center', ...cardShadow,
    },
    emptyStateImage: { width: 140, height: 140, marginBottom: spacing.md },
    emptyStateTitle: { ...type.h2, marginBottom: spacing.xs, textAlign: 'center' },
    emptyStateBody: { ...type.muted, textAlign: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.sm },
    emptyStateButton: {
      backgroundColor: colors.black, borderRadius: radius.pill, paddingVertical: spacing.sm + 4,
      paddingHorizontal: spacing.xl, width: '100%', alignItems: 'center',
    },
    emptyStateButtonText: { color: colors.white, fontWeight: '700', fontSize: 14 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: spacing.lg, marginTop: spacing.lg },
    viewAll: { fontSize: 11, color: colors.inkMuted, fontWeight: '600' },
    statRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
    statCard: { flex: 1, backgroundColor: colors.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, alignItems: 'center' },
    statIcon: { fontSize: 15, marginBottom: 2 },
    statNum: { fontSize: 16, fontWeight: '700', color: colors.ink },
    statLabel: { fontSize: 10.5, color: colors.inkMuted, marginTop: 2 },
    tabList: { flexGrow: 0, maxHeight: 40 },
    tabRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.xs, alignItems: 'center' },
    tab: { paddingVertical: 5, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border, marginRight: 6 },
    tabActive: { backgroundColor: colors.lavender, borderColor: colors.lavenderDeep },
    tabText: { fontSize: 11, color: colors.ink, fontWeight: '500' },
    tabTextActive: { fontWeight: '700' },
    outfitCard: { width: 110, backgroundColor: colors.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
    outfitThumbRow: { alignItems: 'center', marginBottom: spacing.xs },
    outfitName: { fontSize: 12, fontWeight: '600', color: colors.ink },
    outfitMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
    outfitMeta: { fontSize: 10, color: colors.inkMuted },
    outfitRating: { fontSize: 10, color: colors.warning, fontWeight: '600' },
    itemCard: { width: 90, alignItems: 'center', position: 'relative' },
    itemHeart: { position: 'absolute', top: 4, right: 4 },
    itemLabel: { fontSize: 11, color: colors.inkMuted, marginTop: 4, textTransform: 'capitalize', textAlign: 'center' },
    empty: { ...type.muted, padding: spacing.md },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    emptyCta: { backgroundColor: colors.black, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: spacing.xl },
    emptyCtaText: { color: colors.white, fontWeight: '700', fontSize: 14 },
    categoryCard: {
      width: 112, height: 140, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.bgSoft,
    },
    categoryCardImage: { width: '100%', height: '100%', position: 'absolute' },
    categoryCardImageFallback: { alignItems: 'center', justifyContent: 'center' },
    categoryCardScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%' },
    categoryCardTextWrap: { position: 'absolute', bottom: spacing.sm, left: spacing.sm, right: spacing.sm },
    categoryCardLabel: { fontSize: 12, fontWeight: '700', color: '#fff', textTransform: 'capitalize' },
    categoryCardCount: { fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
    signOutLink: { alignSelf: 'center', marginTop: spacing.xl },
    signOutText: { fontSize: 11, color: colors.inkMuted, textDecorationLine: 'underline' },
    fabBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' },
    fabWrap: { position: 'absolute', bottom: spacing.lg, right: spacing.lg, alignItems: 'flex-end' },
    fabMain: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: colors.black,
      alignItems: 'center', justifyContent: 'center', elevation: 4,
      shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
    },
    fabMainIcon: { color: colors.white, fontSize: 26, fontWeight: '400', lineHeight: 28 },
    fabAction: {
      position: 'absolute', bottom: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    },
    fabActionLabel: {
      backgroundColor: colors.card ?? colors.bgSoft, color: colors.ink, fontSize: 12, fontWeight: '600',
      paddingVertical: 6, paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
      overflow: 'hidden',
    },
    fabActionButton: {
      width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
  });
}
