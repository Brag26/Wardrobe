import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getFavoriteItems } from '../../api/wardrobeApi';
import { colors, spacing, type, radius } from '../../theme/theme';

const COLOR_HEX: Record<string, string> = {
  black: '#222', white: '#eee', cream: '#efe6d3', red: '#b13c3c', pink: '#e8a0b8',
  navy: '#213258', green: '#3f6b3f', blue: '#3a5fa0', beige: '#d8c7a8', grey: '#8a8a8a', brown: '#6b4a30',
};

export default function FavoritesScreen() {
  const [items, setItems] = useState<any[]>([]);
  useFocusEffect(useCallback(() => { getFavoriteItems().then(setItems).catch(() => {}); }, []));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text style={styles.title}>Favorites</Text>
      <FlatList
        style={{ flex: 1 }}
        data={items}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.sm }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ListEmptyComponent={<Text style={styles.empty}>No favorites yet — tap ♡ on any item in your closet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={[styles.swatch, { backgroundColor: COLOR_HEX[item.color] ?? '#999' }]} />
            <Text style={styles.itemLabel}>{item.color} {item.category}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { ...type.h1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  card: { flex: 1, backgroundColor: colors.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  swatch: { width: '100%', aspectRatio: 1, borderRadius: radius.sm, marginBottom: spacing.xs },
  itemLabel: { fontSize: 12, fontWeight: '600', color: colors.ink, textTransform: 'capitalize' },
  empty: { ...type.muted, textAlign: 'center', marginTop: spacing.xxl },
});
