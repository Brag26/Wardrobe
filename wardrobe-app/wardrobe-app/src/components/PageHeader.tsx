// src/components/PageHeader.tsx
// The top bar for every screen EXCEPT the Fits home screen. The
// SuperBae logo, notification bell, and hamburger menu are the home
// screen's own identity — repeating them on every single page (Closet,
// Outfits, Chat, Ara, Style Profile...) was noisy and meant "back to
// home" had no single obvious control. This is that control: a plain
// back arrow plus the page's own name, the same pattern as the
// reference ("← Hangouts") — tapping it always returns to Fits.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FigmaIcon } from './icons/FigmaIcon';
import { spacing } from '../theme/theme';
import { useAppTheme } from '../theme/ThemeContext';

export function PageHeader({ title, onBackPress }: { title: string; onBackPress?: () => void }) {
  const navigation = useNavigation<any>();
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);

  return (
    <View style={styles.row}>
      <TouchableOpacity
        // Tab-root screens (Closet, Outfits, Chat, Style Profile...) have
        // no real "back" screen — Fits is the one sensible destination.
        // A screen PUSHED on top of one of those (like "View More" ->
        // AllOutfits) DOES have a real previous screen, so it passes
        // onBackPress={() => navigation.goBack()} to return there
        // instead of jumping all the way home.
        onPress={onBackPress ?? (() => navigation.navigate('HomeTab'))}
        style={styles.backButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Back to Fits"
      >
        <FigmaIcon name="back" size={18} color={colors.ink} />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
    row: { height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, backgroundColor: '#FFFFFF', gap: spacing.sm },
    backButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    title: { ...type.h2 },
  });
}
