// src/screens/Ara/DiscoverScreen.tsx — Figma S7
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ItemThumb } from '../../components/ItemThumb';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { discoverLooks, shuffleLook, getItemsByIds, saveManualOutfit } from '../../api/wardrobeApi';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

const CATEGORIES = [
  { key: 'all', label: 'All Looks' },
  { key: 'casual', label: 'Casual' },
  { key: 'date_night', label: 'Date Night' },
  { key: 'work', label: 'Work' },
];

export default function DiscoverScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);

  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [look, setLook] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (cat: string) => {
    setLoading(true);
    try {
      const result = await discoverLooks(cat);
      setLook(result);
      const resolved = await getItemsByIds(result.itemIds ?? []);
      setItems(resolved);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(category); }, [category, load]);

  const handleShuffle = async () => {
    setLoading(true);
    try {
      const result = await shuffleLook(route.params?.occasion, route.params?.mood);
      setLook(result);
      const resolved = await getItemsByIds(result.itemIds ?? []);
      setItems(resolved);
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleSaveLook = async () => {
    if (!look?.itemIds?.length) return;
    setSaving(true);
    try {
      await saveManualOutfit(look.itemIds);
      navigation.navigate('HomeTab');
    } catch {} finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader />
      <Text style={styles.title}>Discover your next{'\n'}perfect look</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabList} contentContainerStyle={styles.tabRow}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity key={c.key} onPress={() => setCategory(c.key)} style={[styles.tab, category === c.key && styles.tabActive]}>
            <Text style={[styles.tabText, category === c.key && styles.tabTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            <View style={styles.lookCard}>
              <View style={styles.itemRow}>
                {items.length > 0 ? items.map((item) => (
                  <ItemThumb key={item.id} item={item} size={80} />
                )) : <Text style={styles.empty}>No items available for this category yet.</Text>}
              </View>
              {look?.matchScore != null && <Text style={styles.matchScore}>{look.matchScore}% match</Text>}
              {look?.tip && <Text style={styles.tip}>{look.tip}</Text>}
            </View>

            <Button label="Shuffle again" onPress={handleShuffle} variant="secondary" />
            <View style={{ height: spacing.sm }} />
            <Button label="Save this look" onPress={handleSaveLook} loading={saving} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    title: { ...type.h1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    tabList: { flexGrow: 0, maxHeight: 48 },
    tabRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.xs, alignItems: 'center' },
    tab: { paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border, marginRight: spacing.xs },
    tabActive: { backgroundColor: colors.black, borderColor: colors.black },
    tabText: { fontSize: 12, fontWeight: '600', color: colors.ink },
    tabTextActive: { color: colors.white },
    lookCard: { backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg },
    itemRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    matchScore: { ...type.h3, color: colors.success },
    tip: { ...type.muted, marginTop: 4 },
    empty: { ...type.muted },
  });
}
