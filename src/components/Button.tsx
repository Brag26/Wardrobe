import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { radius, spacing } from '../theme/theme';
import { useAppTheme } from '../theme/ThemeContext';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
  disabled?: boolean;
}

export function Button({ label, onPress, variant = 'primary', loading, disabled }: ButtonProps) {
  const { colors } = useAppTheme();

  const backgroundColor =
    variant === 'primary' ? colors.black :
    variant === 'secondary' ? colors.cream : 'transparent';
  const borderColor = variant === 'outline' ? colors.border : 'transparent';
  const textColor = variant === 'primary' ? colors.white : colors.ink;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        styles.base,
        { backgroundColor, borderColor, borderWidth: variant === 'outline' ? 1 : 0 },
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: 14, paddingHorizontal: spacing.lg, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  label: { fontSize: 14, fontWeight: '600' },
});
