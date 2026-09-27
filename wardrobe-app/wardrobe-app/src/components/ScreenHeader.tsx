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
  // Bug: this always rendered a back arrow and always called goBack(),
  // even on screens with nothing to go back to — most visibly the "Me"
  // and "Journal" tabs, which are now bottom-tab ROOTS (Style Profile,
  // Calendar) rather than screens pushed on top of something. Tapping
  // that arrow there did nothing, since there was no previous screen in
  // that tab's own stack to return to. Only show the arrow when either
  // a custom onBack was given, or the navigator actually has history.
  const canGoBack = !!onBack || navigation.canGoBack();
  // Bug: when a screen is opened directly (e.g. Home's "Add outfit" FAB
  // jumping straight to Create Outfit with nothing behind it in that
  // tab's own stack), the default goBack() has nothing local to pop, so
  // it bubbles up and lands on whichever tab the bottom-tab navigator
  // last has in its focus history — which is not necessarily the
  // Wardrobe home screen. Checking this navigator's own stack index
  // first means: pop normally when there's a real previous screen in
  // this stack, otherwise go straight to the Wardrobe (Fits) home tab.
  const handleBack = onBack ?? (() => {
    const state = navigation.getState?.();
    if (state && typeof state.index === 'number' && state.index > 0) {
      navigation.goBack();
    } else {
      navigation.navigate('HomeTab');
    }
  });

  return (
    <View style={styles.row}>
      {canGoBack ? (
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
      ) : (
        // Keep the title aligned the same whether or not a back button
        // is shown, rather than it jumping to the left edge.
        <View style={styles.backButtonSpacer} />
      )}
      {title ? <Text style={[type.h3, { marginLeft: spacing.sm, color: dark ? '#fff' : type.h3.color }]}>{title}</Text> : null}
      <View style={{ flex: 1 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  backButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  backButtonSpacer: { width: 0, height: 36 },
});
