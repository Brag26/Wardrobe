// src/components/FigmaTabBar.tsx
// Bottom navigation built to the Figma bottom-nav export (440 x 93):
//  - white bar, 1.5px #EAEAEA top border
//  - 5 equal slots (Me, Journal, Goals, Fits, Club), 24px icon at y=20
//  - label 16px DM Sans, #696C70 inactive / #141414 active
//  - active tab gets a 3.5px #141414 bar along the top edge of its slot
//
// Only the routes listed in VISIBLE_TABS are drawn. Other tab routes (Ara,
// Closet, Outfits, Chat) stay registered in the navigator so every existing
// navigation.navigate('ClosetTab', ...) call keeps working; they just don't
// get a button in the bar.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBarIcon, TabIconName, TAB_COLORS } from './icons/TabBarIcons';

export const VISIBLE_TABS: { route: string; label: string; icon: TabIconName }[] = [
  { route: 'MeTab', label: 'Me', icon: 'me' },
  { route: 'JournalTab', label: 'Journal', icon: 'journal' },
  { route: 'GoalsTab', label: 'Goals', icon: 'goals' },
  { route: 'HomeTab', label: 'Fits', icon: 'fits' },
  { route: 'ClubTab', label: 'Club', icon: 'club' },
];

export function FigmaTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index]?.name;

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 25) }]}>
      {VISIBLE_TABS.map((tab) => {
        const route = state.routes.find((r) => r.name === tab.route);
        if (!route) return null;
        const focused = activeRoute === tab.route;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
        };

        return (
          <Pressable
            key={tab.route}
            onPress={onPress}
            style={styles.slot}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
          >
            {focused && <View style={styles.indicator} />}
            <TabBarIcon name={tab.icon} focused={focused} />
            <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: TAB_COLORS.background,
    borderTopWidth: 1.5,
    borderTopColor: TAB_COLORS.border,
    paddingHorizontal: 8.75, // slot centres land at 51 / 135.5 / 220 / 304.5 / 389 on a 440 frame
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
  },
  indicator: {
    position: 'absolute',
    top: -1.5, // sits over the top border, like the Figma mask
    left: 1.25,
    right: 1.25, // 82px wide on a 440 frame
    height: 3.5,
    backgroundColor: TAB_COLORS.active,
  },
  label: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'DMSans_400Regular',
    color: TAB_COLORS.inactive,
  },
  labelActive: {
    fontFamily: 'DMSans_600SemiBold',
    color: TAB_COLORS.active,
  },
});
