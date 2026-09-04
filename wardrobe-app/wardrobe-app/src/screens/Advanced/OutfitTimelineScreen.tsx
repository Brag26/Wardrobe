// src/screens/Advanced/OutfitTimelineScreen.tsx — Figma proposal #8 "Outfit Timeline (Day Evolution)"
// Real interaction: toggle outerwear/shoes on and off across four times
// of day, using your actual closet items.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { ItemThumb } from '../../components/ItemThumb';
import { getWardrobeItems } from '../../api/wardrobeApi';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

const TIMES = [
  { key: 'morning', label: 'Morning', hint: 'Add light layer', icon: 'partly-sunny-outline' as const },
  { key: 'afternoon', label: 'Afternoon', hint: 'Remove layer', icon: 'sunny-outline' as const },
  { key: 'evening', label: 'Evening', hint: 'Add blazer', icon: 'cloudy-night-outline' as const },
  { key: 'night', label: 'Night', hint: 'Switch shoes', icon: 'moon-outline' as const },
];

export default function OutfitTimelineScreen() {
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  const [loading, setLoading] = useState(true);
  const [base, setBase] = useState<any[]>([]);
  const [outerwear, setOuterwear] = useState<any>(null);
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>({ morning: true, afternoon: false, evening: true, night: false });

  useEffect(() => {
    (async () => {
      const items = await getWardrobeItems();
      setBase(items.filter((i: any) => ['top', 'bottom', 'dress'].includes(i.category)).slice(0, 2));
      setOuterwear(items.find((i: any) => i.category === 'outerwear') ?? null);
      setLoading(false);
    })();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="Outfit Timeline" />
      <Text style={styles.subtitle}>How your outfit evolves through the day</Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView horizontal contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
          {TIMES.map((t) => (
            <View key={t.key} style={styles.column}>
              <Ionicons name={t.icon} size={22} color={colors.ink} />
              <Text style={styles.timeLabel}>{t.label}</Text>
              <Text style={styles.timeHint}>{t.hint}</Text>
              <View style={styles.layerStack}>
                {base.map((item) => <ItemThumb key={item.id} item={item} size={60} />)}
                {activeLayers[t.key] && outerwear && <ItemThumb item={outerwear} size={60} />}
              </View>
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => setActiveLayers((prev) => ({ ...prev, [t.key]: !prev[t.key] }))}
              >
                <Text style={styles.toggleText}>{activeLayers[t.key] ? 'Remove layer' : 'Add layer'}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  subtitle: { ...type.muted, paddingHorizontal: spacing.lg },
  column: { width: 120, backgroundColor: colors.bgSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, alignItems: 'center' },
  timeIcon: { fontSize: 24 },
  timeLabel: { ...type.h3, marginTop: 4 },
  timeHint: { fontSize: 10, color: colors.inkMuted, marginBottom: spacing.sm },
  layerStack: { gap: spacing.xs, alignItems: 'center' },
  toggleButton: { marginTop: spacing.sm, backgroundColor: colors.black, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.sm },
  toggleText: { color: colors.white, fontSize: 10, fontWeight: '600' },
  });
}
