import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OutfitsScreen from '../screens/Outfits/OutfitsScreen';
import CreateOutfitScreen from '../screens/Outfits/CreateOutfitScreen';
import StartPackingScreen from '../screens/Outfits/StartPackingScreen';
import SelectPackingOutfitsScreen from '../screens/Outfits/SelectPackingOutfitsScreen';
import PackingDetailScreen from '../screens/Outfits/PackingDetailScreen';

const Stack = createNativeStackNavigator();

export default function OutfitsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OutfitsHome" component={OutfitsScreen} />
      <Stack.Screen name="CreateOutfit" component={CreateOutfitScreen} />
      <Stack.Screen name="StartPacking" component={StartPackingScreen} />
      <Stack.Screen name="SelectPackingOutfits" component={SelectPackingOutfitsScreen} />
      <Stack.Screen name="PackingDetail" component={PackingDetailScreen} />
    </Stack.Navigator>
  );
}
