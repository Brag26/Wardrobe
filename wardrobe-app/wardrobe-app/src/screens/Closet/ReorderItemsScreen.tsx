// src/screens/Closet/ReorderItemsScreen.tsx
// Closet Section board's "Reamange the order of items" screen.
//
// HONEST NOTE: the board shows a true drag handle + free reordering.
// This app has neither react-native-gesture-handler nor reanimated
// installed (needed for a real drag-and-drop list, e.g.
// react-native-draggable-flatlist) — adding them means new native
// modules and a babel.config.js change, which needs a rebuild, not
// just a JS change. Rather than fake a "drag" that silently doesn't
// work, this ships an up/down-move version that does the SAME job
// (save a new order to the backend) with a completely reliable
// interaction. Swap in real drag-and-drop later by installing
// react-native-gesture-handler + react-native-reanimated +
// react-native-draggable-flatlist and replacing the FlatList below.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { getWardrobeItems, reorderWardrobeItems } from '../../api/wardrobeApi';
import { ItemThumb } from '../../components/ItemThumb';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

export default function ReorderItemsScreen() {
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getWardrobeItems().then(setItems).catch(() => {}); }, []);

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    setItems((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleDone = async () => {
    setSaving(true);
    try {
      await reorderWardrobeItems(items.map((i) => i.id));
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="Reorder items" />
      <Text style={styles.subtitle}>Use the arrows to move items — this order sets what shows first in your closet.</Text>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 100 }}
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <ItemThumb item={item} size={52} />
            <Text style={styles.rowLabel} numberOfLines={1}>{item.color} {item.category}</Text>
            <View style={styles.arrowGroup}>
              <TouchableOpacity style={styles.arrowBtn} onPress={() => move(index, -1)} disabled={index === 0}>
                <Text style={[styles.arrowText, index === 0 && styles.arrowDisabled]}>↑</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.arrowBtn} onPress={() => move(index, 1)} disabled={index === items.length - 1}>
                <Text style={[styles.arrowText, index === items.length - 1 && styles.arrowDisabled]}>↓</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
      <View style={styles.footer}>
        <Button label="Done" onPress={handleDone} loading={saving} />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  subtitle: { ...type.muted, paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bgSoft,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm,
  },
  rowLabel: { ...type.body, fontWeight: '600', textTransform: 'capitalize', flex: 1 },
  arrowGroup: { flexDirection: 'row', gap: 4 },
  arrowBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 16, fontWeight: '700', color: colors.ink },
  arrowDisabled: { opacity: 0.25 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
  });
}
