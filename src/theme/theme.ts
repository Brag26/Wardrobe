// src/theme/theme.ts
// Light theme colors read directly from the actual Figma screens. Dark
// theme lives alongside it in darkColors — see ThemeContext.tsx for how
// screens switch between them at runtime.

export const lightColors = {
  bg: '#FFFDFB',
  bgSoft: '#FBF7F3',
  cream: '#FAF3EC',
  card: '#FFFFFF',
  border: '#F0E8DF',
  ink: '#1F1B1A',
  inkMuted: '#8B837C',
  black: '#161213',
  white: '#FFFFFF',

  mascot: '#E5E1DB',
  mascotShadow: '#D2CCC3',

  accent: '#161213',
  lavender: '#EDE3F5',
  lavenderDeep: '#C9A9E8',
  pink: '#FCE4E9',
  pinkDeep: '#F2A0B3',
  peach: '#FDEAD9',
  mint: '#E1F2E6',
  sky: '#E1EEF7',

  success: '#3B8352',
  danger: '#C0433A',
  warning: '#B8862E',
  heart: '#E8536A',

  chipBg: '#FBF7F3',
  chipBorder: '#F0E8DF',
  chipSelectedBg: '#EDE3F5',
  chipSelectedBorder: '#C9A9E8',
  chipSelectedText: '#161213',
};

export const darkColors: typeof lightColors = {
  bg: '#141112',
  bgSoft: '#1D1919',
  cream: '#231E1F',
  card: '#1D1919',
  border: '#332C2D',
  ink: '#F3EFEE',
  inkMuted: '#A79F9C',
  black: '#F3EFEE',   // buttons invert: light pill on dark bg
  white: '#141112',   // text/icons on those inverted buttons

  mascot: '#4A4342',
  mascotShadow: '#332C2D',

  accent: '#F3EFEE',
  lavender: '#3A2F44',
  lavenderDeep: '#8E6FB0',
  pink: '#3D2830',
  pinkDeep: '#C56E85',
  peach: '#3C2E22',
  mint: '#1E3327',
  sky: '#1E2C38',

  success: '#5CA876',
  danger: '#E06A61',
  warning: '#D4A24F',
  heart: '#F0728A',

  chipBg: '#1D1919',
  chipBorder: '#332C2D',
  chipSelectedBg: '#3A2F44',
  chipSelectedBorder: '#8E6FB0',
  chipSelectedText: '#F3EFEE',
};

// Default export kept for any screen not yet migrated to the dynamic
// theme (see ThemeContext.tsx) — always resolves to light colors, same
// as before dark mode existed, so nothing breaks for unconverted screens.
export const colors = lightColors;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };

export function buildType(c: typeof lightColors) {
  return {
    h1: { fontSize: 26, fontWeight: '700' as const, color: c.ink },
    h2: { fontSize: 20, fontWeight: '700' as const, color: c.ink },
    h3: { fontSize: 16, fontWeight: '600' as const, color: c.ink },
    body: { fontSize: 14, fontWeight: '400' as const, color: c.ink },
    muted: { fontSize: 12, fontWeight: '400' as const, color: c.inkMuted },
  };
}
export const type = buildType(lightColors);

export function buildChipPastels(c: typeof lightColors) {
  return [c.pink, c.lavender, c.peach, c.mint, c.sky, c.pink, c.lavender, c.peach, c.mint];
}
export const chipPastels = buildChipPastels(lightColors);

// Single shared source of truth for color-name -> swatch hex, covering
// every color in the backend's SUGGESTED_COLORS list (server/src/types/
// domain.ts). Previously ItemDetailsForm.tsx and FilterPanel.tsx each
// kept their OWN separate, incomplete copy of this map — 15-16 colors
// each, missing 8+ real colors (mint, teal, sage, lavender, tan,
// turquoise, chocolate, multicolor) that the backend actually suggests.
// Those showed up as plain text with no colored dot at all — not a
// rendering bug, just genuinely missing entries. One complete map now,
// imported everywhere a color swatch is shown, so it can't drift out
// of sync with the backend's real list again.
export const COLOR_SWATCHES: Record<string, string> = {
  black: '#222222', white: '#f0f0f0', cream: '#efe6d3', grey: '#999999', beige: '#d8c7a8',
  red: '#b13c3c', pink: '#e8a0b8', navy: '#213258', green: '#3f6b3f', mint: '#a8d5ba',
  blue: '#3a5fa0', orange: '#d97b3f', teal: '#2f7d7d', yellow: '#e5c15c', purple: '#8a5fbf',
  sage: '#9caf88', lavender: '#c3b1e1', brown: '#6b4a30', olive: '#6b6b3a', burgundy: '#6b2f3a',
  tan: '#c8a97e', turquoise: '#30bfbf', chocolate: '#4a2f1f',
  // "multicolor" has no single representative hex by definition — a
  // small gradient-ish mid-tone stands in rather than leaving it blank.
  multicolor: '#a37fb0',
};
