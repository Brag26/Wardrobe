import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ItemThumb } from '../../components/ItemThumb';
import { FigmaIcon } from '../../components/icons/FigmaIcon';
import { getFavoriteItems, setItemFavorite } from '../../api/wardrobeApi';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

// QA bug: this screen only ever rendered a flat color swatch
// (COLOR_HEX[item.color]) instead of the item's actual photo — so
// "seeing the favorites section only the colour is appeared not the
// fit" was true for every single favorited item, not just some.
// ItemThumb (the same component Closet uses) already knows how to show
// the real photo and falls back gracefully if one isn't available yet,
// so it replaces the swatch entirely here.
export default function FavoritesScreen() {
  const navigation = useNavigation<any>();
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.floor((screenWidth - spacing.lg * 2 - spacing.sm) / 2);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getFavoriteItems().then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Favorites" />
      <FlatList
        style={{ flex: 1 }}
        data={items}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
        contentContainerStyle={{ paddingVertical: spacing.lg, gap: spacing.sm }}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No favorites yet — tap ♡ on any item in your closet.</Text> : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { width: cardWidth }]}
            onPress={() => navigation.navigate('ItemDetails', { itemId: item.id })}
            activeOpacity={0.85}
          >
            <View style={styles.thumbWrap}>
              <ItemThumb item={item} size={cardWidth} />
              <TouchableOpacity
                style={styles.favButton}
                onPress={() => {
                  // Same optimistic-update pattern as Closet's heart —
                  // unfavoriting here removes the card immediately
                  // instead of waiting on the network round trip.
                  setItems((prev) => prev.filter((i) => i.id !== item.id));
                  setItemFavorite(item.id, false).catch(() => load());
                }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <FigmaIcon name="heart" size={15} color={colors.heart} />
              </TouchableOpacity>
            </View>
            <Text style={styles.itemLabel} numberOfLines={1}>{item.color} {item.category}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    card: { backgroundColor: colors.cream, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
    thumbWrap: { width: '100%', position: 'relative' },
    favButton: {
      position: 'absolute', top: spacing.xs, right: spacing.xs, width: 26, height: 26, borderRadius: 13,
      backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.18, shadowRadius: 3, elevation: 3,
    },
    itemLabel: { fontSize: 12, fontWeight: '600', color: colors.ink, marginTop: spacing.xs, textTransform: 'capitalize' },
    empty: { ...type.muted, textAlign: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
  });
}
