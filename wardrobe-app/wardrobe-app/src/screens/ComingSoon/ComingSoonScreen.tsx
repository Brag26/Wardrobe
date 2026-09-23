// src/screens/ComingSoon/ComingSoonScreen.tsx
// Temporary screen for bottom-nav tabs that exist in the Figma design but
// don't have a built screen yet (Goals, Club). Swap the component in
// RootTabNavigator once the real screen exists.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';

export function makeComingSoonScreen(title: string) {
  return function ComingSoonScreen() {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader />
        <View style={styles.body}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Coming soon</Text>
        </View>
      </SafeAreaView>
    );
  };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  title: { fontSize: 24, fontFamily: 'DMSans_700Bold', color: '#141414' },
  subtitle: { fontSize: 16, fontFamily: 'DMSans_400Regular', color: '#696C70' },
});
