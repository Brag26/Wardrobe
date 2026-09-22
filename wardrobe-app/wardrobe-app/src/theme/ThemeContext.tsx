// src/theme/ThemeContext.tsx
// Dark mode infrastructure is still here (kept intact rather than torn
// out of the 18+ screens that were converted to use it — that would be
// a much bigger, riskier change for the same end result) but is now
// force-disabled: isDark always resolves to false, toggleTheme is a
// no-op, and nothing reads or writes the stored preference anymore.
// Every screen still calls useAppTheme() exactly as before and gets
// real colors back — they just always get the light palette now.

import React, { createContext, useContext } from 'react';
import { lightColors, darkColors, buildType, buildChipPastels } from './theme';

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
  colors: typeof lightColors;
  type: ReturnType<typeof buildType>;
  chipPastels: string[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const value: ThemeContextValue = {
    isDark: false,
    toggleTheme: () => {},
    colors: lightColors,
    type: buildType(lightColors),
    chipPastels: buildChipPastels(lightColors),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used inside <ThemeProvider>');
  return ctx;
}
