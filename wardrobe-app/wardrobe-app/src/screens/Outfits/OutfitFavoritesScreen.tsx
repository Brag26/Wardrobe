// src/screens/Outfits/OutfitFavoritesScreen.tsx
// New per this round's item 3: "There is no way to see the favorite
// outfits under Outfits section" — reached via a heart icon in the
// Outfits header, same placement/pattern as Closet's own heart icon.
// Reuses the same flat-lay collage rendering as OutfitsScreen's grid so
// a favorited outfit looks identical here as it does on the main page.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { FigmaIcon } from '../../components/icons/FigmaIcon';
import { PageHeader } from '../../components/PageHeader';
import { ItemThumb } from '../../components/ItemThumb';
import { getFavoriteOutfits, getItemsByIds, setOutfitFavorite } from '../../api/wardrobeApi';
import { collageLayout } from '../../utils/outfitCollage';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

export default function OutfitFavoritesScreen() {
  const navigation = useNavigation<any>();
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  const [outfits, setOutfits] = useState<any[]>([]);
  const [previews, setPreviews] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFavoriteOutfits();
      setOutfits(data);
      const allIds = data.flatMap((o: any) => o.itemIds ?? []).filter(Boolean);
      if (allIds.length > 0) {
        const resolved = await getItemsByIds([...new Set(allIds)] as string[]);
        const map: Record<string, any> = {};
        resolved.forEach((item: any) => { map[item.id] = item; });
        setPreviews(map);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageHeader title="Favorite Outfits" onBackPress={() => navigation.goBack()} />
      <FlatList
        data={outfits}
        keyExtractor={(o) => o.id}
        numColumns={2}
        style={{ flex: 1 }}
        columnWrapperStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.lg }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.empty}>No favorite outfits yet — tap the ♡ on any outfit to save it here.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const pieces = (item.itemIds ?? []).map((id: string) => previews[id]).filter(Boolean);
          const ready = pieces.filter((p: any) => p.backgroundRemoval?.status === 'done').slice(0, 4);
          const shown = ready.length > 0 ? ready : pieces.slice(0, 4);
          const usingRawFallback = ready.length === 0 && pieces.length > 0;
          return (
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.favButton}
                onPress={() => {
                  setOutfits((prev) => prev.filter((o) => o.id !== item.id));
                  setOutfitFavorite(item.id, false).catch(() => load());
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <FigmaIcon name="heart" size={13} color={colors.heart ?? '#FF5C7A'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.collageWrap}
                onPress={() => navigation.navigate('OutfitDetail', { outfitId: item.id })}
                activeOpacity={0.85}
              >
                {usingRawFallback ? (
                  <View style={styles.rawFallbackGrid}>
                    {shown.map((p: any, idx: number) => (
                      <View key={p.id ?? idx} style={styles.rawFallbackThumb}><ItemThumb item={p} size={64} /></View>
                    ))}
                  </View>
                ) : shown.length > 1 ? (
                  collageLayout(shown).map((pos, idx) => (
                    <View key={idx} style={[styles.collagePiece, { top: pos.top, left: pos.left, zIndex: pos.zIndex }]}>
                      <ItemThumb item={shown[idx]} size={pos.thumbSize} noBorder />
                    </View>
                  ))
                ) : (
                  <ItemThumb item={shown[0] ?? null} size={150} noBorder />
                )}
              </TouchableOpacity>
              <Text style={styles.outfitName} numberOfLines={1}>{item.name ?? 'Untitled outfit'}</Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    emptyState: { alignItems: 'center', paddingTop: spacing.xxl, paddingHorizontal: spacing.lg },
    empty: { ...type.muted, textAlign: 'center' },
    card: { flex: 1, backgroundColor: colors.cream, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', position: 'relative' },
    favButton: {
      position: 'absolute', top: spacing.sm, right: spacing.sm, zIndex: 2, width: 26, height: 26, borderRadius: 13,
      backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
    },
    collageWrap: { width: 150, height: 187.5, position: 'relative' },
    collagePiece: { position: 'absolute' },
    rawFallbackGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 150, height: 187.5, gap: 4, alignItems: 'center', justifyContent: 'center' },
    rawFallbackThumb: { borderRadius: radius.sm, overflow: 'hidden' },
    outfitName: { fontSize: 12, fontWeight: '600', color: colors.ink, marginTop: spacing.xs },
  });
}
