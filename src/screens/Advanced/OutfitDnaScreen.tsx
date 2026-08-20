// src/screens/Advanced/OutfitDnaScreen.tsx — Figma proposal #7 "AI Outfit DNA"
// Real computed breakdown from the outfit's actual items (color variety,
// occasion-tag match density, rating data, wear recency) — not random
// numbers. Deterministic: same outfit always scores the same.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { getOutfit, listOutfits, getWardrobeItems } from '../../api/wardrobeApi';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

function computeBreakdown(items: any[]) {
  if (items.length === 0) return { confidence: 0, comfort: 0, style: 0, balance: 0, trendiness: 0, overall: 0 };

  const colors_ = new Set(items.map((i) => i.color));
  const ratedItems = items.filter((i) => i.rating != null);
  const avgRating = ratedItems.length ? ratedItems.reduce((s, i) => s + i.rating, 0) / ratedItems.length : 3.5;
  const avgWear = items.reduce((s, i) => s + (i.wearCount ?? 0), 0) / items.length;
  const occasionOverlap = items.filter((i) => i.occasionTags?.length > 0).length / items.length;

  const confidence = Math.round(60 + occasionOverlap * 30 + Math.min(avgWear, 10));
  const comfort = Math.round(65 + Math.min(avgWear * 1.5, 25));
  const style = Math.round(55 + (avgRating / 5) * 35 + colors_.size * 2);
  const balance = Math.round(50 + Math.min(colors_.size * 8, 40));
  const trendiness = Math.round(50 + (items.filter((i) => i.isFavorite).length / items.length) * 40);

  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const c = clamp(confidence), co = clamp(comfort), s = clamp(style), b = clamp(balance), t = clamp(trendiness);
  const overall = Math.round((c + co + s + b + t) / 5);
  return { confidence: c, comfort: co, style: s, balance: b, trendiness: t, overall };
}

function Bar({ label, value, styles }: { label: string; value: number; styles: any }) {
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}><View style={[styles.barFill, { width: `${value}%` }]} /></View>
      <Text style={styles.barValue}>{value}%</Text>
    </View>
  );
}

export default function OutfitDnaScreen() {
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  const route = useRoute<any>();
  const [loading, setLoading] = useState(true);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        let items: any[] = [];
        if (route.params?.outfitId) {
          const outfit = await getOutfit(route.params.outfitId);
          items = outfit.items ?? [];
        } else {
          const outfits = await listOutfits('all');
          if (outfits[0]) {
            const outfit = await getOutfit(outfits[0].id);
            items = outfit.items ?? [];
          } else {
            items = (await getWardrobeItems()).slice(0, 3);
          }
        }
        setItemCount(items.length);
        setBreakdown(computeBreakdown(items));
      } catch {
        setBreakdown(computeBreakdown([]));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="AI Outfit DNA" />
      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, alignItems: 'center' }}>
          <View style={styles.overallCircle}>
            <Text style={styles.overallNum}>{breakdown.overall}%</Text>
            <Text style={styles.overallLabel}>Overall Match</Text>
          </View>
          <Text style={styles.itemCountText}>Based on {itemCount} piece{itemCount === 1 ? '' : 's'}</Text>

          <View style={styles.card}>
            <Bar label="Confidence" value={breakdown.confidence} styles={styles} />
            <Bar label="Comfort" value={breakdown.comfort} styles={styles} />
            <Bar label="Style" value={breakdown.style} styles={styles} />
            <Bar label="Balance" value={breakdown.balance} styles={styles} />
            <Bar label="Trendiness" value={breakdown.trendiness} styles={styles} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  overallCircle: {
    width: 140, height: 140, borderRadius: 70, borderWidth: 8, borderColor: colors.black,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.md,
  },
  overallNum: { fontSize: 28, fontWeight: '700', color: colors.ink },
  overallLabel: { fontSize: 11, color: colors.inkMuted },
  itemCountText: { ...type.muted, marginTop: spacing.sm, marginBottom: spacing.lg },
  card: { width: '100%', backgroundColor: colors.bgSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  barRow: { marginBottom: spacing.md },
  barLabel: { fontSize: 12, fontWeight: '600', color: colors.ink, marginBottom: 4 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.black },
  barValue: { fontSize: 11, color: colors.inkMuted, marginTop: 2, textAlign: 'right' },
  });
}
