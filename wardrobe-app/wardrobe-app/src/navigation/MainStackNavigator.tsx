// src/navigation/MainStackNavigator.tsx
// Wraps the visible tab bar (Me/Journal/Goals/Fits/Club, plus the
// not-in-the-bar Ara/Closet/Outfits/Chat tabs). The Advanced Studio
// section (previously reached via a long-press on the Ara banner) has
// been removed per user request.
//
// Bug fix: Style Profile (Body Shape, Color Analysis) and the outfit
// Calendar used to be registered TWICE — once as their own tabs inside
// RootTabNavigator ("MeTab", "JournalTab"), and again as separate,
// duplicate top-level screens here ("Profile", "CalendarStack"), which
// Home's calendar/person icons and the FAB's "Schedule outfit" action
// used to jump to instead of the tab. Two different mount points for
// the same screens meant two different behaviors depending on how you
// got there: reached via the tab, the persistent bottom bar stays
// visible and there's nowhere further back to go (by design, it's a
// tab root); reached via the old top-level route, the bar disappeared
// and a real "back" existed — inconsistent spacing AND inconsistent
// back-button behavior for what looked like the same screen. Every
// caller now points at the tab, so there's exactly one way to reach
// these, and the duplicate top-level routes are gone.
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RootTabNavigator from './RootTabNavigator';

const Stack = createNativeStackNavigator();

export default function MainStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={RootTabNavigator} />
    </Stack.Navigator>
  );
}
