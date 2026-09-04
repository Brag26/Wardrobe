import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ClosetScreen from '../screens/Closet/ClosetScreen';
import AddItemScreen from '../screens/Closet/AddItemScreen';
import ItemDetailsScreen from '../screens/Closet/ItemDetailsScreen';
import FavoritesScreen from '../screens/Favorites/FavoritesScreen';
import BinScreen from '../screens/Bin/BinScreen';
import ArchiveScreen from '../screens/Closet/ArchiveScreen';
import ReorderItemsScreen from '../screens/Closet/ReorderItemsScreen';
import BulkUploadScreen from '../screens/Closet/BulkUploadScreen';

const Stack = createNativeStackNavigator();

export default function ClosetNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ClosetHome" component={ClosetScreen} />
      <Stack.Screen name="AddItem" component={AddItemScreen} />
      <Stack.Screen name="ItemDetails" component={ItemDetailsScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="Bin" component={BinScreen} />
      <Stack.Screen name="Archive" component={ArchiveScreen} />
      <Stack.Screen name="ReorderItems" component={ReorderItemsScreen} />
      <Stack.Screen name="BulkUpload" component={BulkUploadScreen} />
    </Stack.Navigator>
  );
}
