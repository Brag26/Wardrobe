// src/screens/Advanced/ClosetHealthScreen.tsx — Figma proposal #13 "AI Closet Health"
// Real computed score from actual closet composition: category variety,
// color balance, and how casual-heavy the closet is.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { getWardrobeItems } from '../../api/wardrobeApi';
import { colors, spacing, type, radius } from '../../theme/theme';

function computeHealth(items: any[]) {
  const total = items.length || 1;
  const categories = new Set(items.map((i) => i.category));
  const colors_ = new Set(items.map((i) => i.color));
  const casualCount = items.filter((i) => i.occasionTags?.includes('coffee') || i.occasionTags?.includes('brunch')).length;
  const partyCount = items.filter((i) => i.occasionTags?.includes('party')).length;
  const casualRatio = casualCount / total;

  const checks = [
    { label: 'Good color balance', pass: colors_.size >= 4 },
    { label: 'Good category variety', pass: categories.size >= 4 },
    { label: 'Enough basics', pass: total >= 8 },
    { label: 'Enough party wear', pass: partyCount >= 2 },
    { label: 'Not too many casual tops', pass: casualRatio <= 0.5 },
  ];
  const score = Math.round((checks.filter((c) => c.pass).length / checks.length) * 100);
  return { score, checks };
}

export default function ClosetHealthScreen() {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    getWardrobeItems().then((items) => setHealth(computeHealth(items))).finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="AI Closet Health" />
      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, alignItems: 'center' }}>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreNum}>{health.score}%</Text>
          </View>
          <Text style={styles.scoreLabel}>Closet Health Score</Text>

          <View style={styles.card}>
            {health.checks.map((c: any) => (
              <View key={c.label} style={styles.checkRow}>
                <Ionicons name={c.pass ? 'checkmark-circle' : 'alert-circle'} size={17} color={c.pass ? (colors.success ?? '#3B8352') : (colors.warning ?? '#B8862E')} style={{ marginRight: spacing.sm }} />
                <Text style={styles.checkLabel}>{c.label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scoreCircle: { width: 130, height: 130, borderRadius: 65, borderWidth: 8, borderColor: colors.black, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  scoreNum: { fontSize: 28, fontWeight: '700', color: colors.ink },
  scoreLabel: { ...type.h3, marginTop: spacing.sm, marginBottom: spacing.lg },
  card: { width: '100%', backgroundColor: colors.bgSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkLabel: { ...type.body },
});
