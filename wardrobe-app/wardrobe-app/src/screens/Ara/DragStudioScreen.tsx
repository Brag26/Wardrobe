// src/screens/Ara/DragStudioScreen.tsx — Figma S8 "AI Drag Studio"
// Interactive item swapping: tap a slot, pick a replacement from your
// closet. (Note: true drag-gesture reordering would need
// react-native-gesture-handler/reanimated, which aren't in this
// project's dependencies yet — tap-to-swap gives the same functional
// outcome — mixing items into an outfit — without adding that.)

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ItemThumb } from '../../components/ItemThumb';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { getWardrobeItems, saveManualOutfit } from '../../api/wardrobeApi';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

const SLOTS = [
  { key: 'top', label: 'Top', categories: ['top', 'dress'] },
  { key: 'bottom', label: 'Bottom', categories: ['bottom', 'pants', 'jeans'] },
  { key: 'shoes', label: 'Shoes', categories: ['shoes'] },
  { key: 'bag', label: 'Bag', categories: ['bag', 'accessory'] },
];

export default function DragStudioScreen() {
  const navigation = useNavigation<any>();
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  const [closet, setCloset] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, any>>({});
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getWardrobeItems().then(setCloset).catch(() => {}); }, []);

  const optionsFor = (slotKey: string) => {
    const slot = SLOTS.find((s) => s.key === slotKey);
    if (!slot) return [];
    return closet.filter((item) => slot.categories.includes(item.category));
  };

  const handlePick = (slotKey: string, item: any) => {
    setSelected((prev) => ({ ...prev, [slotKey]: item }));
    setActiveSlot(null);
  };

  const handleSave = async () => {
    const itemIds = Object.values(selected).map((i: any) => i.id);
    if (itemIds.length === 0) return Alert.alert('Pick some items', 'Tap a slot below and choose at least one piece.');
    setSaving(true);
    try {
      await saveManualOutfit(itemIds);
      navigation.navigate('HomeTab');
    } catch (e: any) {
      Alert.alert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader />
      <Text style={styles.title}>AI Drag Studio</Text>
      <Text style={styles.subtitle}>Tap a slot, swap in whatever you like</Text>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {/* Outfit preview — the "mannequin" slots */}
        <View style={styles.slotsRow}>
          {SLOTS.map((slot) => (
            <TouchableOpacity key={slot.key} style={styles.slotWrap} onPress={() => setActiveSlot(slot.key)}>
              <ItemThumb item={selected[slot.key] ?? null} size={70} selected={activeSlot === slot.key} />
              <Text style={styles.slotLabel}>{slot.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeSlot && (
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Pick a {SLOTS.find((s) => s.key === activeSlot)?.label.toLowerCase()}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {optionsFor(activeSlot).length === 0 ? (
                <Text style={styles.empty}>No items in this category yet.</Text>
              ) : (
                optionsFor(activeSlot).map((item) => (
                  <TouchableOpacity key={item.id} onPress={() => handlePick(activeSlot, item)}>
                    <ItemThumb item={item} size={70} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        )}

        <View style={{ height: spacing.lg }} />
        <Button label="Save this look" onPress={handleSave} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    title: { ...type.h1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    subtitle: { ...type.muted, paddingHorizontal: spacing.lg, marginTop: 2, marginBottom: spacing.md },
    slotsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.lg },
    slotWrap: { alignItems: 'center' },
    slotLabel: { fontSize: 11, color: colors.inkMuted, marginTop: 4 },
    pickerCard: { backgroundColor: colors.bgSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
    pickerTitle: { ...type.h3, marginBottom: spacing.sm, textTransform: 'capitalize' },
    empty: { ...type.muted },
  });
}
