// src/screens/Profile/BodyShapeScreen.tsx
// Self-select body shape — confirmed as the reliable approach vs. AI
// guessing from a photo. Standard fashion-industry categories.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { getProfile, setBodyShape } from '../../api/wardrobeApi';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';
import { AppIcon } from '../../components/icons/AppIcons';

const SHAPES = [
  { key: 'hourglass', label: 'Hourglass', emoji: '⏳', desc: 'Bust and hips are balanced, waist is defined' },
  { key: 'pear', label: 'Pear', emoji: '🍐', desc: 'Hips are wider than bust and shoulders' },
  { key: 'apple', label: 'Apple', emoji: '🍎', desc: 'Fuller through the middle, slimmer legs' },
  { key: 'rectangle', label: 'Rectangle', emoji: '📏', desc: 'Bust, waist, and hips are similar in width' },
  { key: 'inverted_triangle', label: 'Inverted Triangle', emoji: '🔺', desc: 'Shoulders/bust are wider than hips' },
];

export default function BodyShapeScreen() {
  const navigation = useNavigation<any>();
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);

  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getProfile().then((p) => setSelected(p.bodyShape)).catch(() => {}); }, []);

  const handleSelect = async (key: string) => {
    setSelected(key);
    setSaving(true);
    try {
      await setBodyShape(key);
    } catch (e: any) {
      Alert.alert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Body Shape" />
      <Text style={styles.subtitle}>
        This helps Ara pick silhouettes that actually work for you — you know your body better than a photo guess ever could.
      </Text>

      {SHAPES.map((s) => (
        <TouchableOpacity
          key={s.key}
          style={[styles.card, selected === s.key && styles.cardSelected]}
          onPress={() => handleSelect(s.key)}
          activeOpacity={0.85}
        >
          <Text style={styles.emoji}>{s.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>{s.label}</Text>
            <Text style={styles.cardDesc}>{s.desc}</Text>
          </View>
          {selected === s.key && <AppIcon name="checkmarkCircle" size={22} color={colors.success} />}
        </TouchableOpacity>
      ))}
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
    subtitle: { ...type.muted, marginBottom: spacing.lg, lineHeight: 17 },
    card: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSoft,
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
    },
    cardSelected: { borderColor: colors.lavenderDeep, backgroundColor: colors.lavender },
    emoji: { fontSize: 28, marginRight: spacing.md },
    cardLabel: { ...type.h3 },
    cardDesc: { ...type.muted, marginTop: 2 },
    check: { fontSize: 18, color: colors.success, fontWeight: '700' },
  });
}
