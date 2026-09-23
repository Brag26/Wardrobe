import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { getFavoriteItems } from '../../api/wardrobeApi';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

const COLOR_HEX: Record<string, string> = {
  black: '#222', white: '#eee', cream: '#efe6d3', red: '#b13c3c', pink: '#e8a0b8',
  navy: '#213258', green: '#3f6b3f', blue: '#3a5fa0', beige: '#d8c7a8', grey: '#8a8a8a', brown: '#6b4a30',
};

export default function FavoritesScreen() {
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  const [items, setItems] = useState<any[]>([]);
  useFocusEffect(useCallback(() => { getFavoriteItems().then(setItems).catch(() => {}); }, []));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Favorites" />
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

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { ...type.h1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  card: { flex: 1, backgroundColor: colors.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  swatch: { width: '100%', aspectRatio: 1, borderRadius: radius.sm, marginBottom: spacing.xs },
  itemLabel: { fontSize: 12, fontWeight: '600', color: colors.ink, textTransform: 'capitalize' },
  empty: { ...type.muted, textAlign: 'center', marginTop: spacing.xxl },
  });
}
