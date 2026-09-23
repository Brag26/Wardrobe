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
  // Set on screens with a full-bleed dark/photo background (e.g. Ara's
  // "match" screen). Bug: 'outline' and 'secondary' always used the
  // light theme's dark ink-on-transparent styling regardless of what
  // was behind them — invisible dark text on a dark background, as on
  // the "Try a different mood" button after Ara builds a look.
  dark?: boolean;
}

export function Button({ label, onPress, variant = 'primary', loading, disabled, dark }: ButtonProps) {
  const { colors } = useAppTheme();

  const backgroundColor =
    variant === 'primary' ? (dark ? '#fff' : colors.black) :
    variant === 'secondary' ? (dark ? 'rgba(255,255,255,0.14)' : colors.cream) : 'transparent';
  // QA flagged this exact button (the "Shuffle again"/cancel-style
  // action after Ara builds an outfit) as not clearly visible —
  // secondary had no border at all, just near-white text on a
  // near-white background with nothing to define its edges. Giving it
  // the same border outline gets a real, visible boundary instead of
  // relying on a background-color difference that barely reads on a
  // white/cream screen.
  const borderColor = variant === 'outline' || variant === 'secondary'
    ? (dark ? 'rgba(255,255,255,0.4)' : colors.border)
    : 'transparent';
  const textColor = variant === 'primary' ? (dark ? '#141414' : colors.white) : (dark ? '#fff' : colors.ink);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        styles.base,
        { backgroundColor, borderColor, borderWidth: variant === 'outline' || variant === 'secondary' ? 1 : 0 },
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
  label: { fontSize: 14, fontWeight: '600', letterSpacing: 0.2 },
});
