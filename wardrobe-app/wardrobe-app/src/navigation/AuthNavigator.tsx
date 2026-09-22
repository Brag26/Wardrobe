import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PhoneScreen from '../screens/Auth/PhoneScreen';

const Stack = createNativeStackNavigator();

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Phone" component={PhoneScreen} />
    </Stack.Navigator>
  );
}
