import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdvancedHubScreen from '../screens/Advanced/AdvancedHubScreen';
import WeatherAdaptScreen from '../screens/Advanced/WeatherAdaptScreen';
import OutfitDnaScreen from '../screens/Advanced/OutfitDnaScreen';
import ClosetHeatmapScreen from '../screens/Advanced/ClosetHeatmapScreen';
import ClosetHealthScreen from '../screens/Advanced/ClosetHealthScreen';
import OutfitTimelineScreen from '../screens/Advanced/OutfitTimelineScreen';
import MagicCircleScreen from '../screens/Advanced/MagicCircleScreen';
import SmartMirrorScreen from '../screens/Advanced/SmartMirrorScreen';
import VisionSearchScreen from '../screens/Advanced/VisionSearchScreen';

const Stack = createNativeStackNavigator();

export default function AdvancedNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdvancedHub" component={AdvancedHubScreen} />
      <Stack.Screen name="WeatherAdapt" component={WeatherAdaptScreen} />
      <Stack.Screen name="OutfitDna" component={OutfitDnaScreen} />
      <Stack.Screen name="ClosetHeatmap" component={ClosetHeatmapScreen} />
      <Stack.Screen name="ClosetHealth" component={ClosetHealthScreen} />
      <Stack.Screen name="OutfitTimeline" component={OutfitTimelineScreen} />
      <Stack.Screen name="MagicCircle" component={MagicCircleScreen} />
      <Stack.Screen name="SmartMirror" component={SmartMirrorScreen} />
      <Stack.Screen name="VisionSearch" component={VisionSearchScreen} />
    </Stack.Navigator>
  );
}
