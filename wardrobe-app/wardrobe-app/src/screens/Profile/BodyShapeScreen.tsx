// src/screens/Profile/BodyShapeScreen.tsx
// Self-select body shape — confirmed as the reliable approach vs. AI
// guessing from a photo. Standard fashion-industry categories.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { getProfile, setBodyShape } from '../../api/wardrobeApi';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';
import { AppIcon } from '../../components/icons/AppIcons';
import { BodyShapeIcon, BodyShapeKey } from '../../components/icons/BodyShapeIcons';

const SHAPES: { key: BodyShapeKey; label: string; desc: string }[] = [
  { key: 'hourglass', label: 'Hourglass', desc: 'Bust and hips are balanced, waist is defined' },
  { key: 'pear', label: 'Pear', desc: 'Hips are wider than bust and shoulders' },
  { key: 'apple', label: 'Apple', desc: 'Fuller through the middle, slimmer legs' },
  { key: 'rectangle', label: 'Rectangle', desc: 'Bust, waist, and hips are similar in width' },
  { key: 'inverted_triangle', label: 'Inverted Triangle', desc: 'Shoulders/bust are wider than hips' },
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
      {/* Back button sits flush with ScreenHeader's own padding here, same
          as every other ScreenHeader screen — the outer container no
          longer double-pads it, which was shifting it out of place
          relative to the rest of the app. */}
      <ScreenHeader title="Body Type" />
      <ScrollView contentContainerStyle={styles.content}>
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
            <View style={styles.iconWrap}>
              <BodyShapeIcon shape={s.key} size={44} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>{s.label}</Text>
              <Text style={styles.cardDesc}>{s.desc}</Text>
            </View>
            {selected === s.key && <AppIcon name="checkmarkCircle" size={22} color={colors.success} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, paddingBottom: spacing.xl },
    subtitle: { ...type.muted, marginBottom: spacing.lg, lineHeight: 17 },
    card: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSoft,
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
    },
    cardSelected: { borderColor: colors.lavenderDeep, backgroundColor: colors.lavender },
    iconWrap: {
      width: 48, height: 48, borderRadius: radius.md, overflow: 'hidden',
      marginRight: spacing.md, alignItems: 'center', justifyContent: 'center',
    },
    cardLabel: { ...type.h3 },
    cardDesc: { ...type.muted, marginTop: 2 },
    check: { fontSize: 18, color: colors.success, fontWeight: '700' },
  });
}
