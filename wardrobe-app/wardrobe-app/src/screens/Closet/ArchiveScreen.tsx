// src/screens/Closet/ArchiveScreen.tsx
// Closet Section board's "Archive" screen — items hidden from the main
// closet grid but not deleted. Tap items to select, then Delete
// (moves to Bin) or Unarchive (returns to the main closet) from the
// bottom action bar — matches the board's two-button bottom layout.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getArchivedItems, unarchiveWardrobeItem, moveItemToBin } from '../../api/wardrobeApi';
import { ItemThumb } from '../../components/ItemThumb';
import { ScreenHeader } from '../../components/ScreenHeader';
import { FigmaIcon } from '../../components/icons/FigmaIcon';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

export default function ArchiveScreen() {
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => { getArchivedItems().then(setItems).catch(() => {}); }, []);
  useFocusEffect(useCallback(() => { load(); setSelected(new Set()); }, [load]));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleUnarchive = async () => {
    setBusy(true);
    try {
      await Promise.all(Array.from(selected).map((id) => unarchiveWardrobeItem(id)));
      setItems((prev) => prev.filter((i) => !selected.has(i.id)));
      setSelected(new Set());
      setNote('Unarchived successfully');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete these items?', `${selected.size} item(s) will move to the Bin.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setBusy(true);
          try {
            await Promise.all(Array.from(selected).map((id) => moveItemToBin(id)));
            setItems((prev) => prev.filter((i) => !selected.has(i.id)));
            setSelected(new Set());
            setNote('Clothes deleted');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="Archive" />
      {items.length === 0 ? (
        <Text style={styles.empty}>There are no archived clothes.</Text>
      ) : (
        <>
          <Text style={styles.subtitle}>Tap items to select, then unarchive or delete.</Text>
          {note && <Text style={styles.note}>{note}</Text>}
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            numColumns={3}
            columnWrapperStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
            contentContainerStyle={{ gap: spacing.sm, paddingBottom: 100 }}
            renderItem={({ item }) => {
              const isSelected = selected.has(item.id);
              return (
                <TouchableOpacity style={[styles.cell, isSelected && styles.cellSelected]} onPress={() => toggle(item.id)} activeOpacity={0.8}>
                  <ItemThumb item={item} size={100} />
                  {isSelected && <View style={styles.checkBadge}><FigmaIcon name="checkmark" size={12} color={colors.white} /></View>}
                </TouchableOpacity>
              );
            }}
          />
          {selected.size > 0 && (
            <View style={styles.actionBar}>
              <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={handleDelete} disabled={busy}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.unarchiveBtn]} onPress={handleUnarchive} disabled={busy}>
                <Text style={styles.unarchiveBtnText}>Unarchive</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  subtitle: { ...type.muted, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  note: { ...type.body, color: colors.success, fontWeight: '600', paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  empty: { ...type.muted, textAlign: 'center', marginTop: spacing.xxl },
  cell: { width: 100, height: 100, borderRadius: radius.md, overflow: 'hidden', position: 'relative' },
  cellSelected: { borderWidth: 2, borderColor: colors.black },
  checkBadge: {
    position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center',
  },
  checkText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: spacing.sm,
    padding: spacing.lg, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border,
  },
  actionBtn: { flex: 1, borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center' },
  deleteBtn: { backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border },
  deleteBtnText: { color: colors.danger, fontWeight: '600' },
  unarchiveBtn: { backgroundColor: colors.black },
  unarchiveBtnText: { color: colors.white, fontWeight: '600' },
  });
}
