// src/navigation/MainStackNavigator.tsx
// Wraps the visible tab bar (Home/Ara/Closet/Outfits/Chat) plus:
//  - the hidden Advanced Studio section (long-press the Ara banner)
//  - the visible Style Profile section (body shape + color analysis,
//    reached from a real Home quick action, not hidden)
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RootTabNavigator from './RootTabNavigator';
import AdvancedNavigator from './AdvancedNavigator';
import ProfileNavigator from './ProfileNavigator';
import CalendarNavigator from './CalendarNavigator';

const Stack = createNativeStackNavigator();

export default function MainStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={RootTabNavigator} />
      <Stack.Screen name="Advanced" component={AdvancedNavigator} />
      <Stack.Screen name="Profile" component={ProfileNavigator} />
      <Stack.Screen name="CalendarStack" component={CalendarNavigator} />
    </Stack.Navigator>
  );
}
