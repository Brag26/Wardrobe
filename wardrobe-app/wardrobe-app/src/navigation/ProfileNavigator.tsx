import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import StyleProfileHubScreen from '../screens/Profile/StyleProfileHubScreen';
import BodyShapeScreen from '../screens/Profile/BodyShapeScreen';
import ColorAnalysisScreen from '../screens/Profile/ColorAnalysisScreen';

const Stack = createNativeStackNavigator();

export default function ProfileNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StyleProfileHub" component={StyleProfileHubScreen} />
      <Stack.Screen name="BodyShape" component={BodyShapeScreen} />
      <Stack.Screen name="ColorAnalysis" component={ColorAnalysisScreen} />
    </Stack.Navigator>
  );
}
