// src/components/AppHeader.tsx
// The persistent top header shown on every main tab screen (Home, Ara,
// Closet, Outfits, Chat) — SuperBae wordmark on the left, notification
// bell and hamburger menu on the right. Previously this only existed
// (informally, ad-hoc) on Home; the client's actual Figma reference
// shows this exact header as the default across every page, not a
// Home-only element, so it's a real shared component now instead of
// logic duplicated per screen.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { spacing, radius, cardShadow } from '../theme/theme';
import { useAppTheme } from '../theme/ThemeContext';
import { SuperBaeLogo, BellIcon, MenuIcon } from './icons/SuperBaeIcons';
import { AppIcon, AppIconName } from './icons/AppIcons';

const MENU_ITEMS: { label: string; icon: AppIconName; tab: string }[] = [
  { label: 'Fits', icon: 'home', tab: 'HomeTab' },
  { label: 'Ara', icon: 'sparkles', tab: 'AraTab' },
  { label: 'Closet', icon: 'shirt', tab: 'ClosetTab' },
  { label: 'Outfits', icon: 'albums', tab: 'OutfitsTab' },
  { label: 'Chat', icon: 'chatBubble', tab: 'ChatTab' },
];

export function AppHeader({ hasNotifications = false }: { hasNotifications?: boolean }) {
  const navigation = useNavigation<any>();
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={styles.row}>
      <View style={styles.logoWrap}>
        <SuperBaeLogo />
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.iconButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Notifications">
          <BellIcon hasNotifications={hasNotifications} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={() => setMenuOpen(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Menu">
          <MenuIcon />
        </TouchableOpacity>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuSheet}>
            {MENU_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.menuItem}
                onPress={() => { setMenuOpen(false); navigation.navigate(item.tab); }}
              >
                <AppIcon name={item.icon} size={18} color={colors.ink} />
                <Text style={styles.menuItemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
    // Figma top nav: 64px tall white bar. Logo starts 30px from the left;
    // bell box at x=326, menu box at x=384 (both 24x24), 32px from the right.
    row: {
      height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingLeft: 30, paddingRight: 32, backgroundColor: '#FFFFFF',
    },
    logoWrap: { marginTop: 2 }, // logo sits ~1px below the row's centre line in the design
    actions: { flexDirection: 'row', alignItems: 'center', gap: 34 },
    iconButton: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
    menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'flex-end' },
    menuSheet: {
      marginTop: 60, marginRight: spacing.lg, backgroundColor: colors.card, borderRadius: radius.md,
      paddingVertical: spacing.xs, minWidth: 160, ...cardShadow,
    },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    menuItemText: { ...type.body, fontWeight: '600' },
  });
}
