// src/screens/Calendar/DayOutfitScreen.tsx
// Tapping a calendar date lands here — shows the assigned "Outfit of
// the Day" if one exists, or an outfit picker to assign one. Saving
// shows the "Successfully Wrapped" confirmation from the Home board's
// OOTD flow.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { ItemThumb } from '../../components/ItemThumb';
import { listOutfits, getItemsByIds, getCalendarDay, setCalendarDay, deleteCalendarDay } from '../../api/wardrobeApi';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function DayOutfitScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { date } = route.params;
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const [entry, setEntry] = useState<any>(undefined); // undefined = loading, null = none assigned
  const [assignedOutfit, setAssignedOutfit] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [outfits, setOutfits] = useState<any[]>([]);
  const [previews, setPreviews] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [wrapped, setWrapped] = useState(false);

  const load = useCallback(async () => {
    const e = await getCalendarDay(date).catch(() => null);
    setEntry(e);
    if (e) {
      const [o] = await Promise.all([listOutfits('all')]);
      const found = o.find((x: any) => x.id === e.outfitId);
      setAssignedOutfit(found ?? null);
      if (found?.itemIds?.[0]) {
        const [item] = await getItemsByIds([found.itemIds[0]]);
        setPreview(item ?? null);
      }
    } else {
      const [outfitData] = await Promise.all([listOutfits('all')]);
      setOutfits(outfitData);
      const allIds = outfitData.flatMap((o: any) => o.itemIds ?? []).filter(Boolean);
      if (allIds.length) {
        const resolved = await getItemsByIds([...new Set(allIds)] as string[]);
        const map: Record<string, any> = {};
        resolved.forEach((item: any) => { map[item.id] = item; });
        setPreviews(map);
      }
    }
  }, [date]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAssign = async (outfitId: string) => {
    setSaving(true);
    try {
      await setCalendarDay(date, outfitId);
      setWrapped(true);
    } catch (e: any) {
      Alert.alert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = () => {
    Alert.alert('Remove this outfit?', `This will clear the outfit planned for ${formatDate(date)}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await deleteCalendarDay(date); load(); } },
    ]);
  };

  if (wrapped) {
    return (
      <SafeAreaView style={styles.wrapContainer} edges={['top', 'bottom']}>
        <View style={styles.wrapCenter}>
          <Ionicons name="checkmark-circle" size={56} color="#8FE3AE" />
          <Text style={styles.wrapTitle}>Successfully Wrapped</Text>
          <Text style={styles.wrapSubtitle}>
            {formatDate(date)}'s look is set — keeping every outfit comfy, confident, and on-brand every moment with a smile.
          </Text>
          <View style={{ height: spacing.lg }} />
          <Button label="Done" onPress={() => navigation.navigate('Calendar')} />
        </View>
      </SafeAreaView>
    );
  }

  if (entry === undefined) return <SafeAreaView style={styles.container} />;

  if (entry && assignedOutfit) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScreenHeader title={formatDate(date)} />
        <View style={styles.assignedWrap}>
          <ItemThumb item={preview} size={180} />
          <Text style={[type.h2, { marginTop: spacing.md }]}>{assignedOutfit.name ?? 'Untitled outfit'}</Text>
          <Text style={type.muted}>{assignedOutfit.itemIds?.length ?? 0} pieces</Text>
          <View style={{ height: spacing.lg }} />
          <Button label="Change outfit" variant="outline" onPress={() => setEntry(null)} />
          <View style={{ height: spacing.sm }} />
          <Button label="Remove" variant="secondary" onPress={handleRemove} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title={formatDate(date)} />
      <Text style={[type.muted, { paddingHorizontal: spacing.lg, marginBottom: spacing.sm }]}>Pick an outfit for this day.</Text>
      <FlatList
        data={outfits}
        keyExtractor={(o) => o.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.lg }}
        ListEmptyComponent={<Text style={type.muted}>No outfits yet — create one first.</Text>}
        renderItem={({ item }) => {
          const p = item.itemIds?.[0] ? previews[item.itemIds[0]] : null;
          return (
            <TouchableOpacity style={styles.outfitCard} onPress={() => handleAssign(item.id)} disabled={saving} activeOpacity={0.85}>
              <ItemThumb item={p} size={130} />
              <Text style={styles.outfitName} numberOfLines={1}>{item.name ?? 'Untitled outfit'}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    assignedWrap: { flex: 1, alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xxl },
    outfitCard: { flex: 1, backgroundColor: colors.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, alignItems: 'center' },
    outfitName: { fontSize: 12, fontWeight: '600', color: colors.ink, marginTop: spacing.xs },
    wrapContainer: { flex: 1, backgroundColor: colors.black },
    wrapCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    wrapCheck: { fontSize: 56, marginBottom: spacing.md },
    wrapTitle: { color: colors.white, fontSize: 22, fontWeight: '700', marginBottom: spacing.sm },
    wrapSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  });
}
