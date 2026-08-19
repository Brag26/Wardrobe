import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/Home/HomeScreen';
import AraNavigator from './AraNavigator';
import ClosetNavigator from './ClosetNavigator';
import OutfitsNavigator from './OutfitsNavigator';
import ChatScreen from '../screens/Chat/ChatScreen';
import { colors, radius } from '../theme/theme';

const Tab = createBottomTabNavigator();

// Real icon set (Ionicons, bundled free with every Expo project via
// @expo/vector-icons — no new dependency) instead of raw emoji glyphs.
// Emoji render as their own fixed full-color image and completely
// ignore tabBarActiveTintColor, so every tab looked visually identical
// regardless of which was active; a vector icon set can actually be
// tinted, outlined-vs-filled swapped for focus state, etc.
const ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  HomeTab: { active: 'home', inactive: 'home-outline' },
  AraTab: { active: 'sparkles', inactive: 'sparkles-outline' },
  ClosetTab: { active: 'shirt', inactive: 'shirt-outline' },
  OutfitsTab: { active: 'file-tray-stacked', inactive: 'file-tray-stacked-outline' },
  ChatTab: { active: 'chatbubble-ellipses', inactive: 'chatbubble-ellipses-outline' },
};

function TabIcon({ routeName, focused }: { routeName: string; focused: boolean }) {
  const iconName = focused ? ICONS[routeName].active : ICONS[routeName].inactive;
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={iconName} size={19} color={focused ? colors.black : colors.inkMuted} />
    </View>
  );
}

export default function RootTabNavigator() {
  // The tab bar previously used a fixed height/paddingBottom (60 /
  // 8px), which completely ignored the device's actual bottom
  // safe-area inset — on phones with an on-screen system nav bar
  // (common on Android, especially 3-button navigation rather than
  // gesture nav), that system bar sits ON TOP of the tab bar's bottom
  // portion, making the tabs untappable. React Navigation normally
  // handles this automatically, but a custom tabBarStyle overrides
  // that built-in behavior — so it has to be done manually here via
  // useSafeAreaInsets() instead.
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.black,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarLabelStyle: { fontSize: 11 },
        tabBarStyle: {
          borderTopColor: colors.border,
          height: 56 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
        },
        tabBarIcon: ({ focused }) => <TabIcon routeName={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="AraTab" component={AraNavigator} options={{ tabBarLabel: 'Ara' }} />
      <Tab.Screen name="ClosetTab" component={ClosetNavigator} options={{ tabBarLabel: 'Closet' }} />
      <Tab.Screen name="OutfitsTab" component={OutfitsNavigator} options={{ tabBarLabel: 'Outfits' }} />
      <Tab.Screen name="ChatTab" component={ChatScreen} options={{ tabBarLabel: 'Chat' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 40, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: colors.lavender },
});
