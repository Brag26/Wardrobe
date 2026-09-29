// src/screens/Profile/BodyShapeScreen.tsx
// Self-select body shape — confirmed as the reliable approach vs. AI
// guessing from a photo. Standard fashion-industry categories.
//
// Layout matches the reference design shared for this screen: a
// 2-column grid of cards, each topped with the full-size illustrated
// swatch (color + line art already baked into BodyShapeIcons.tsx —
// no separate background needed) and the label/description below it,
// plus a "Compare shapes" footer link. Title stays "Body Type" per
// the earlier wording fix (the reference screenshot itself still says
// "Body Shape" — flagging that in case the wording should revert).
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList, useWindowDimensions } from 'react-native';
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
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.floor((screenWidth - spacing.lg * 2 - spacing.sm) / 2);

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
      <FlatList
        data={SHAPES}
        keyExtractor={(s) => s.key}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.sm }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm }}
        ListHeaderComponent={
          <Text style={styles.subtitle}>
            This helps Ara pick silhouettes that actually work for you — you know your body better than a photo guess ever could.
          </Text>
        }
        ListFooterComponent={
          <TouchableOpacity
            style={styles.compareRow}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Coming soon', 'Side-by-side shape comparison isn’t built yet.')}
          >
            <AppIcon name="swapVertical" size={16} color={colors.ink} />
            <Text style={styles.compareText}>Compare shapes</Text>
          </TouchableOpacity>
        }
        renderItem={({ item: s }) => (
          <TouchableOpacity
            style={[styles.card, { width: cardWidth }, selected === s.key && styles.cardSelected]}
            onPress={() => handleSelect(s.key)}
            activeOpacity={0.85}
          >
            <View style={[styles.illustrationWrap, { width: cardWidth - 2, height: cardWidth - 2 }]}>
              <BodyShapeIcon shape={s.key} size={cardWidth - 2} />
              {selected === s.key && (
                <View style={styles.checkBadge}>
                  <AppIcon name="checkmarkCircle" size={22} color={colors.success} />
                </View>
              )}
            </View>
            <Text style={styles.cardLabel}>{s.label}</Text>
            <Text style={styles.cardDesc}>{s.desc}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    subtitle: { ...type.muted, marginBottom: spacing.lg, lineHeight: 17 },
    card: { marginBottom: spacing.md, borderRadius: radius.lg },
    cardSelected: { borderWidth: 2, borderColor: colors.lavenderDeep, borderRadius: radius.lg, padding: 2, marginTop: -2, marginLeft: -2 },
    illustrationWrap: { borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.sm },
    checkBadge: {
      position: 'absolute', top: spacing.xs, right: spacing.xs, width: 26, height: 26, borderRadius: 13,
      backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.18, shadowRadius: 3, elevation: 3,
    },
    cardLabel: { ...type.h3 },
    cardDesc: { ...type.muted, marginTop: 2 },
    compareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.md, paddingVertical: spacing.sm },
    compareText: { fontSize: 14, fontWeight: '600', color: colors.ink },
  });
}
