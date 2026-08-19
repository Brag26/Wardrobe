import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';

import AuthNavigator from './src/navigation/AuthNavigator';
import MainStackNavigator from './src/navigation/MainStackNavigator';
import { useAuthStore } from './src/store/authStore';
import { colors } from './src/theme/theme';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeContext';

function AppInner() {
  const { isSignedIn, isLoading, checkStoredAuth } = useAuthStore();
  const { isDark } = useAppTheme();

  useEffect(() => { checkStoredAuth(); }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {isSignedIn ? <MainStackNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AppInner />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
