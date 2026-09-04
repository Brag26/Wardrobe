// src/components/ScreenHeader.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FigmaIcon } from './icons/FigmaIcon';
import { spacing } from '../theme/theme';
import { useAppTheme } from '../theme/ThemeContext';

interface ScreenHeaderProps {
  title?: string;
  onBack?: () => void;
  // Use over a full-bleed dark/photo background (e.g. the "crafting
  // magic" match screen) where the normal theme-based back button
  // would be low-contrast — renders a translucent white pill instead.
  dark?: boolean;
}

export function ScreenHeader({ title, onBack, dark }: ScreenHeaderProps) {
  const navigation = useNavigation<any>();
  const { colors, type } = useAppTheme();
  const handleBack = onBack ?? (() => navigation.goBack());

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={handleBack}
        style={[
          styles.backButton,
          dark
            ? { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.3)' }
            : { backgroundColor: colors.bgSoft, borderColor: colors.border },
        ]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <FigmaIcon name="back" size={19} color={dark ? '#fff' : colors.ink} />
      </TouchableOpacity>
      {title ? <Text style={[type.h3, { marginLeft: spacing.sm, color: dark ? '#fff' : type.h3.color }]}>{title}</Text> : null}
      <View style={{ flex: 1 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  backButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
