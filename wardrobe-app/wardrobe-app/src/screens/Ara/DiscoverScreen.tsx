// src/screens/Ara/DiscoverScreen.tsx — Figma S7
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ItemThumb } from '../../components/ItemThumb';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { discoverLooks, shuffleLook, getItemsByIds, saveManualOutfit, getRecommendationUsage, getRecommendationHistory } from '../../api/wardrobeApi';
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
  // item 10: daily usage cap on AI recommendations (Discover + Shuffle).
  const [usage, setUsage] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);
  // item 11: "history should be there to verify what were selected
  // previously" — recent past picks, shown below the current one.
  const [history, setHistory] = useState<any[]>([]);
  const [historyItems, setHistoryItems] = useState<Record<string, any>>({});

  const loadUsage = useCallback(() => { getRecommendationUsage().then(setUsage).catch(() => {}); }, []);
  const loadHistory = useCallback(async () => {
    try {
      const logs = await getRecommendationHistory();
      setHistory(logs);
      const allIds = [...new Set(logs.flatMap((l: any) => l.itemIds ?? []))] as string[];
      if (allIds.length > 0) {
        const resolved = await getItemsByIds(allIds);
        const map: Record<string, any> = {};
        resolved.forEach((item: any) => { map[item.id] = item; });
        setHistoryItems(map);
      }
    } catch {}
  }, []);

  const load = useCallback(async (cat: string) => {
    setLoading(true);
    setLimitError(null);
    try {
      const result = await discoverLooks(cat);
      setLook(result);
      const resolved = await getItemsByIds(result.itemIds ?? []);
      setItems(resolved);
      loadUsage();
      loadHistory();
    } catch (e: any) {
      // 429 (daily limit reached) surfaces as a real message here
      // instead of the request just silently doing nothing.
      setLimitError(e?.message ?? "Couldn't load a recommendation — try again.");
    } finally {
      setLoading(false);
    }
  }, [loadUsage, loadHistory]);

  useEffect(() => { load(category); }, [category, load]);

  const handleShuffle = async () => {
    setLoading(true);
    setLimitError(null);
    try {
      const result = await shuffleLook(route.params?.occasion, route.params?.mood);
      setLook(result);
      const resolved = await getItemsByIds(result.itemIds ?? []);
      setItems(resolved);
      loadUsage();
      loadHistory();
    } catch (e: any) {
      setLimitError(e?.message ?? "Couldn't load a recommendation — try again.");
    } finally {
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
      {usage && (
        <Text style={styles.usageText}>
          {usage.remaining > 0
            ? `${usage.remaining} of ${usage.limit} AI recommendations left today`
            : `You've used all ${usage.limit} AI recommendations for today`}
        </Text>
      )}

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
        ) : limitError ? (
          <View style={styles.lookCard}>
            <Text style={styles.limitErrorText}>{limitError}</Text>
          </View>
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

            <Button label="Shuffle again" onPress={handleShuffle} variant="secondary" disabled={usage?.remaining === 0} />
            <View style={{ height: spacing.sm }} />
            <Button label="Save this look" onPress={handleSaveLook} loading={saving} />
          </>
        )}

        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Recent picks</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {history.map((log) => {
                const pieces = (log.itemIds ?? []).map((id: string) => historyItems[id]).filter(Boolean);
                return (
                  <View key={log.id} style={styles.historyCard}>
                    <View style={styles.historyItemRow}>
                      {pieces.slice(0, 3).map((item: any) => <ItemThumb key={item.id} item={item} size={44} />)}
                    </View>
                    {log.matchScore != null && <Text style={styles.historyScore}>{log.matchScore}% match</Text>}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    title: { ...type.h1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    usageText: { ...type.muted, paddingHorizontal: spacing.lg, marginTop: 2 },
    limitErrorText: { ...type.body, textAlign: 'center', color: colors.ink },
    historySection: { marginTop: spacing.lg },
    historyTitle: { ...type.h3, marginBottom: spacing.sm },
    historyCard: { backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
    historyItemRow: { flexDirection: 'row', gap: 4 },
    historyScore: { fontSize: 11, color: colors.success, fontWeight: '600', marginTop: 4 },
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
