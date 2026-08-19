import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getBinItems, restoreItemFromBin } from '../../api/wardrobeApi';
import { colors, spacing, type, radius } from '../../theme/theme';

export default function BinScreen() {
  const [items, setItems] = useState<any[]>([]);
  const load = useCallback(() => { getBinItems().then(setItems).catch(() => {}); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text style={styles.title}>Bin</Text>
      <Text style={styles.subtitle}>Items are permanently deleted after 30 days</Text>
      <FlatList
        style={{ flex: 1 }}
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ListEmptyComponent={<Text style={styles.empty}>Bin is empty.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.itemLabel}>{item.color} {item.category}</Text>
            <TouchableOpacity onPress={async () => { await restoreItemFromBin(item.id); load(); }}>
              <Text style={styles.restoreText}>Restore</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { ...type.h1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  subtitle: { ...type.muted, paddingHorizontal: spacing.lg, marginTop: 2 },
  card: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  itemLabel: { ...type.body, fontWeight: '600', textTransform: 'capitalize' },
  restoreText: { color: colors.success, fontWeight: '600', fontSize: 12 },
  empty: { ...type.muted, textAlign: 'center', marginTop: spacing.xxl },
});
