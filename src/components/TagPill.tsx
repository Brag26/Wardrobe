// src/components/TagPill.tsx
// Compact horizontal pill for multi-tag selection (category/color/
// occasion on Add Item, Filters, etc). The big circular Chip component
// is right for Occasion/Mood (matches the Figma icon-grid exactly), but
// wrong for tagging screens with many options — 20+ of those 62px
// circles wrapping across rows was eating well over half the screen.
// This is the same interaction, a fraction of the height.
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { radius, spacing } from '../theme/theme';
import { useAppTheme } from '../theme/ThemeContext';

interface TagPillProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  dotColor?: string; // optional small color swatch dot, useful for color tags
}

export function TagPill({ label, selected, onPress, dotColor }: TagPillProps) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.pill,
        {
          backgroundColor: selected ? colors.lavender : colors.bgSoft,
          borderColor: selected ? colors.lavenderDeep : colors.border,
        },
      ]}
    >
      {dotColor ? <TouchableOpacity disabled style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <Text style={[styles.label, { color: colors.ink }, selected && styles.labelSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 7, paddingHorizontal: spacing.sm,
    borderRadius: radius.pill, borderWidth: 1,
    marginRight: 6, marginBottom: 6,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 5 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  labelSelected: { fontWeight: '700' },
});
