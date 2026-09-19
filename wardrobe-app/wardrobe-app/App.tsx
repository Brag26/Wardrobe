import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { DMSans_400Regular, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';

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
  // Ionicons' font asset has to load asynchronously before it can
  // render any glyph — previously nothing waited for this at all, so
  // every icon rendered via <Ionicons> (still used in ~20 places
  // alongside the custom FigmaIcon set — tab bar, calendar, mic/send/
  // briefcase, etc. that weren't in the Figma export) would render
  // BLANK until the font finished loading in the background.
  // Inconsistent and worse on a cold launch — exactly the "blank
  // icons all over" symptom, not a broken icon reference, just
  // nothing waiting for the font before the UI painted.
  //
  // Deliberately NOT using expo-splash-screen here to keep the native
  // splash image up during this wait — that's a real native module
  // requiring an exact SDK-54-matched version, and guessing that wrong
  // risks the same native-build failure `expo-camera`'s version
  // mismatch caused earlier. A plain loading view is a completely
  // safe, JS-only way to get the same practical fix (no blank icons)
  // without that risk — worth revisiting later once there's a reliable
  // way to confirm the exact right splash-screen version.
  // Same font-loading gate as Ionicons below, now also loading DM
  // Sans (the spec'd typeface — see theme.ts's buildType, which
  // references these exact font family names). Same reasoning as the
  // Ionicons comment: block on load rather than let text render in
  // the system font default and flash to DM Sans a moment later.
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    DMSans_400Regular,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AppInner />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
