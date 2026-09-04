import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from '../screens/Ara/WelcomeScreen';
import OccasionScreen from '../screens/Ara/OccasionScreen';
import MoodScreen from '../screens/Ara/MoodScreen';
import BuildingScreen from '../screens/Ara/BuildingScreen';
import DiscoverScreen from '../screens/Ara/DiscoverScreen';
import DragStudioScreen from '../screens/Ara/DragStudioScreen';

const Stack = createNativeStackNavigator();

export default function AraNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Occasion" component={OccasionScreen} />
      <Stack.Screen name="Mood" component={MoodScreen} />
      <Stack.Screen name="Building" component={BuildingScreen} />
      <Stack.Screen name="Discover" component={DiscoverScreen} />
      <Stack.Screen name="DragStudio" component={DragStudioScreen} />
    </Stack.Navigator>
  );
}
