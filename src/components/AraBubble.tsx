// src/components/AraBubble.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, radius } from '../theme/theme';
import { useAppTheme } from '../theme/ThemeContext';

interface AraBubbleProps {
  text: string;
  subtext?: string;
}

export function AraBubble({ text, subtext }: AraBubbleProps) {
  const { colors, type } = useAppTheme();
  return (
    <View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.tail, { backgroundColor: colors.card, borderColor: colors.border }]} />
      <Text style={type.h3}>{text}</Text>
      {subtext ? <Text style={[type.muted, { marginTop: 4, lineHeight: 15 }]}>{subtext}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    position: 'relative',
  },
  tail: {
    position: 'absolute',
    left: spacing.lg,
    top: -6,
    width: 12,
    height: 12,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
});
