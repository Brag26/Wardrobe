// src/components/Chip.tsx
// Matches S2/S3's actual layout: a colored circle holding the emoji,
// with the label underneath. Now theme-aware — pulls live colors so it
// renders correctly in dark mode instead of staying stuck light.
import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { radius } from '../theme/theme';
import { useAppTheme } from '../theme/ThemeContext';

interface ChipProps {
  label: string;
  emoji?: string;
  selected: boolean;
  onPress: () => void;
  pastelColor?: string;
}

export function Chip({ label, emoji, selected, onPress, pastelColor }: ChipProps) {
  const { colors } = useAppTheme();
  const bg = selected ? colors.lavender : (pastelColor ?? colors.peach);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.wrap}>
      <View style={[
        styles.circle,
        { backgroundColor: bg, borderColor: selected ? colors.lavenderDeep : 'transparent' },
      ]}>
        {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      </View>
      <Text style={[styles.label, { color: colors.ink }, selected && styles.labelSelected]} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: 84 },
  circle: {
    width: 62, height: 62, borderRadius: 31,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  emoji: { fontSize: 24 },
  label: { fontSize: 12.5, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  labelSelected: { fontWeight: '700' },
});
