// src/theme/ThemeContext.tsx
// Real, working dark mode — not a static swap. Wraps the app, persists
// the user's choice, and gives screens a `useAppTheme()` hook to pull
// live colors/type from.
//
// COVERAGE NOTE: this infrastructure is real and works. HomeScreen has
// been fully converted to use it as the reference implementation. Other
// screens still import the static `colors` from theme.ts directly,
// which always renders in light mode regardless of the toggle — they
// need the same conversion (swap static imports for useAppTheme()
// inside the component, and turn StyleSheet.create into a function
// called with the live colors) to pick up dark mode too. That's real
// remaining work across the other ~15 screens, not done in this pass.

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors, buildType, buildChipPastels } from './theme';

const THEME_STORAGE_KEY = 'wardrobe_theme_preference';

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
  colors: typeof lightColors;
  type: ReturnType<typeof buildType>;
  chipPastels: string[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((val) => {
      if (val === 'dark') setIsDark(true);
    });
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
      return next;
    });
  };

  const activeColors = isDark ? darkColors : lightColors;

  const value: ThemeContextValue = {
    isDark,
    toggleTheme,
    colors: activeColors,
    type: buildType(activeColors),
    chipPastels: buildChipPastels(activeColors),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used inside <ThemeProvider>');
  return ctx;
}
