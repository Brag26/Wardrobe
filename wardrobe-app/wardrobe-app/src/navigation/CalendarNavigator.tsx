import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CalendarScreen from '../screens/Calendar/CalendarScreen';
import DayOutfitScreen from '../screens/Calendar/DayOutfitScreen';

const Stack = createNativeStackNavigator();

export default function CalendarNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Calendar" component={CalendarScreen} />
      <Stack.Screen name="DayOutfit" component={DayOutfitScreen} />
    </Stack.Navigator>
  );
}
