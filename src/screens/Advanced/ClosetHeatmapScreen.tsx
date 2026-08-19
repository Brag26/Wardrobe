// src/screens/Advanced/ClosetHeatmapScreen.tsx — Figma proposal #10 "AI Closet Heatmap"
// Real data: buckets every closet item by its actual wearCount field.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ItemThumb } from '../../components/ItemThumb';
import { getWardrobeItems } from '../../api/wardrobeApi';
import { colors, spacing, type, radius } from '../../theme/theme';

function bucketFor(wearCount: number): { label: string; color: string } {
  if (wearCount >= 10) return { label: 'Often', color: '#3B8352' };
  if (wearCount >= 4) return { label: 'Sometimes', color: '#B8862E' };
  if (wearCount >= 1) return { label: 'Rarely', color: '#C0433A' };
  return { label: 'Never', color: colors.inkMuted };
}

export default function ClosetHeatmapScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => { getWardrobeItems().then(setItems).finally(() => setLoading(false)); }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="AI Closet Heatmap" />
      <Text style={styles.subtitle}>See what you wear most, and what you don't</Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {items.map((item) => {
            const bucket = bucketFor(item.wearCount ?? 0);
            return (
              <View key={item.id} style={styles.card}>
                <ItemThumb item={item} size={96} />
                <View style={[styles.dot, { backgroundColor: bucket.color }]} />
                <Text style={styles.bucketLabel}>{bucket.label}</Text>
              </View>
            );
          })}
          {items.length === 0 && <Text style={styles.empty}>Add items to your closet to see this.</Text>}
        </ScrollView>
      )}
      <View style={styles.legend}>
        {['Often', 'Sometimes', 'Rarely', 'Never'].map((label, idx) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: ['#3B8352', '#B8862E', '#C0433A', colors.inkMuted][idx] }]} />
            <Text style={styles.legendLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  subtitle: { ...type.muted, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.lg, gap: spacing.md },
  card: { width: '30%', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: spacing.xs },
  bucketLabel: { fontSize: 11, color: colors.inkMuted, marginTop: 2 },
  empty: { ...type.muted },
  legend: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  legendLabel: { fontSize: 11, color: colors.inkMuted },
});
