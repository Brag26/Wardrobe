import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { FigmaIcon } from '../../components/icons/FigmaIcon';
import { getBinItems, restoreItemFromBin, permanentlyDeleteItem } from '../../api/wardrobeApi';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

export default function BinScreen() {
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  const [items, setItems] = useState<any[]>([]);
  const load = useCallback(() => { getBinItems().then(setItems).catch(() => {}); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Previously the ONLY option here was "Restore" — no way to actually
  // delete something for good without waiting out the full 30 days,
  // even though the permanent-delete endpoint already existed and is
  // used elsewhere (Archive screen). Real gap, not just a
  // discoverability issue — this genuinely didn't exist here before.
  const handleDeleteForever = (item: any) => {
    Alert.alert(
      'Delete forever?',
      `This removes "${item.color} ${item.category?.replace(/_/g, ' ')}" immediately — it can't be undone, unlike waiting out the 30-day bin period.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete forever', style: 'destructive', onPress: async () => { await permanentlyDeleteItem(item.id); load(); } },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="Bin" />
      <Text style={styles.subtitle}>Items are permanently deleted after 30 days — or delete one immediately below.</Text>
      <FlatList
        style={{ flex: 1 }}
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ListEmptyComponent={<Text style={styles.empty}>Bin is empty.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.itemLabel}>{item.color} {item.category}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <TouchableOpacity onPress={async () => { await restoreItemFromBin(item.id); load(); }}>
                <Text style={styles.restoreText}>Restore</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteForever(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <FigmaIcon name="trash" size={16} color={colors.heart ?? '#C0433A'} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  subtitle: { ...type.muted, paddingHorizontal: spacing.lg, marginTop: 2 },
  card: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  itemLabel: { ...type.body, fontWeight: '600', textTransform: 'capitalize' },
  restoreText: { color: colors.success, fontWeight: '600', fontSize: 12 },
  empty: { ...type.muted, textAlign: 'center', marginTop: spacing.xxl },
  });
}
