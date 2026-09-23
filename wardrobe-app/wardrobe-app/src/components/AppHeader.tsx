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
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, cardShadow } from '../theme/theme';
import { useAppTheme } from '../theme/ThemeContext';

const MENU_ITEMS = [
  { label: 'Fits', icon: 'home-outline', tab: 'HomeTab' },
  { label: 'Ara', icon: 'sparkles-outline', tab: 'AraTab' },
  { label: 'Closet', icon: 'shirt-outline', tab: 'ClosetTab' },
  { label: 'Outfits', icon: 'albums-outline', tab: 'OutfitsTab' },
  { label: 'Chat', icon: 'chatbubble-outline', tab: 'ChatTab' },
];

export function AppHeader() {
  const navigation = useNavigation<any>();
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={styles.row}>
      <Text style={styles.logo}>Super<Text style={styles.logoAccent}>Bae</Text></Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.iconButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="notifications-outline" size={20} color={colors.ink} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={() => setMenuOpen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="menu-outline" size={22} color={colors.ink} />
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
                <Ionicons name={item.icon as any} size={18} color={colors.ink} />
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
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs,
    },
    logo: { fontSize: 20, fontWeight: '700' as const, fontFamily: 'DMSans_700Bold', color: colors.ink, letterSpacing: -0.3 },
    logoAccent: { color: colors.lavenderDeep },
    actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    iconButton: {
      width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border,
    },
    menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'flex-end' },
    menuSheet: {
      marginTop: 60, marginRight: spacing.lg, backgroundColor: colors.card, borderRadius: radius.md,
      paddingVertical: spacing.xs, minWidth: 160, ...cardShadow,
    },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    menuItemText: { ...type.body, fontWeight: '600' },
  });
}
