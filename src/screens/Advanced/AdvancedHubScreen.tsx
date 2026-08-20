// src/screens/Advanced/AdvancedHubScreen.tsx
// Hidden menu — reached only via long-press on the Ara mascot on Home.
// Everything from the original pitch proposal that isn't in the real
// dev Figma lives here: real and working, just not part of the main
// visible flow.
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

const FEATURES = [
  { key: 'WeatherAdapt', title: 'Weather AI Adaptation', desc: 'Real live weather → seasonal closet suggestions', icon: 'partly-sunny-outline' as const },
  { key: 'OutfitDna', title: 'AI Outfit DNA', desc: 'Confidence, comfort, style, balance, trendiness breakdown', icon: 'analytics-outline' as const },
  { key: 'ClosetHeatmap', title: 'AI Closet Heatmap', desc: 'What you wear most vs. least, from real data', icon: 'flame-outline' as const },
  { key: 'ClosetHealth', title: 'AI Closet Health', desc: 'A composition score for your whole closet', icon: 'pulse-outline' as const },
  { key: 'OutfitTimeline', title: 'Outfit Timeline', desc: 'How your look evolves morning → night', icon: 'time-outline' as const },
  { key: 'MagicCircle', title: 'AI Magic Circle', desc: 'Your closet orbiting around you (2D approximation of the original 3D concept)', icon: 'sync-outline' as const },
  { key: 'SmartMirror', title: 'Smart Mirror', desc: 'Camera + draggable outfit overlay (approximation — no body tracking)', icon: 'body-outline' as const },
  { key: 'VisionSearch', title: 'AI Vision Search', desc: 'Photo → matching items by category (approximation — no image embeddings)', icon: 'camera-outline' as const },
];

export default function AdvancedHubScreen() {
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  const navigation = useNavigation<any>();
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="Advanced Studio" />
      <Text style={styles.subtitle}>Experimental features from the original concept — hidden from the main app, but real and working.</Text>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
        {FEATURES.map((f) => (
          <TouchableOpacity key={f.key} style={styles.card} onPress={() => navigation.navigate(f.key)}>
            <View style={styles.iconWrap}><Ionicons name={f.icon} size={20} color={colors.ink} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{f.title}</Text>
              <Text style={styles.cardDesc}>{f.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  subtitle: { ...type.muted, paddingHorizontal: spacing.lg, lineHeight: 16 },
  card: { flexDirection: 'row', backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  iconWrap: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  cardTitle: { ...type.h3 },
  cardDesc: { ...type.muted, marginTop: 2, lineHeight: 15 },
  });
}
