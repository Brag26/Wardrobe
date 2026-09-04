// src/theme/theme.ts
// Light theme colors read directly from the actual Figma screens. Dark
// theme lives alongside it in darkColors — see ThemeContext.tsx for how
// screens switch between them at runtime.
//
// v2 — design refresh toward a more minimal/cohesive, less "bright
// pastel scrapbook" feel. Two concrete changes, not a guess-and-hope
// repaint:
//   1. The five accent pastels (lavender/pink/peach/mint/sky) were each
//      picked independently and didn't read as one family — desaturated
//      them toward a shared warm-neutral undertone so they feel curated
//      together instead of scattered. lavenderDeep (the app's actual
//      primary accent — active tab, calendar highlight, badges) went
//      from a brighter candy-purple to a more grounded, designer-ish
//      violet.
//   2. Typography had NO letterSpacing anywhere and NO lineHeight on
//      most sizes — the exact gap that made chat bubbles look cramped
//      (fixed there already) is fixed here at the SOURCE, so every
//      screen using `type.*` gets proper line-height automatically,
//      not just the one place that was manually patched. Headers also
//      get slightly negative tracking, a standard technique for a
//      tighter, more premium feel on large text.
// Every existing key name is preserved — only values changed — so no
// other file needs to change to pick this up.

export const lightColors = {
  bg: '#FFFDFB',
  bgSoft: '#FBF7F3',
  cream: '#FAF3EC',
  card: '#FFFFFF',
  border: '#EFE7DD',
  ink: '#1F1B1A',
  inkMuted: '#8B837C',
  black: '#161213',
  white: '#FFFFFF',

  mascot: '#E5E1DB',
  mascotShadow: '#D2CCC3',

  accent: '#161213',
  lavender: '#E9E0F3',
  lavenderDeep: '#9B82C4',
  pink: '#F7DFE4',
  pinkDeep: '#D98CA0',
  peach: '#F6E2CF',
  mint: '#DDECE3',
  sky: '#DDE9F2',

  success: '#3B8352',
  danger: '#C0433A',
  warning: '#B8862E',
  heart: '#E8536A',

  chipBg: '#FBF7F3',
  chipBorder: '#EFE7DD',
  chipSelectedBg: '#E9E0F3',
  chipSelectedBorder: '#9B82C4',
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
  lavender: '#372D42',
  lavenderDeep: '#8267AD',
  pink: '#3B2830',
  pinkDeep: '#BC7186',
  peach: '#3A2C22',
  mint: '#1E3227',
  sky: '#1E2B38',

  success: '#5CA876',
  danger: '#E06A61',
  warning: '#D4A24F',
  heart: '#F0728A',

  chipBg: '#1D1919',
  chipBorder: '#332C2D',
  chipSelectedBg: '#372D42',
  chipSelectedBorder: '#8267AD',
  chipSelectedText: '#F3EFEE',
};

// Default export kept for any screen not yet migrated to the dynamic
// theme (see ThemeContext.tsx) — always resolves to light colors, same
// as before dark mode existed, so nothing breaks for unconverted screens.
export const colors = lightColors;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };

export function buildType(c: typeof lightColors) {
  return {
    h1: { fontSize: 28, fontWeight: '700' as const, color: c.ink, letterSpacing: -0.4, lineHeight: 34 },
    h2: { fontSize: 20, fontWeight: '700' as const, color: c.ink, letterSpacing: -0.2, lineHeight: 26 },
    h3: { fontSize: 16, fontWeight: '600' as const, color: c.ink, letterSpacing: -0.1, lineHeight: 21 },
    body: { fontSize: 14, fontWeight: '400' as const, color: c.ink, lineHeight: 20 },
    muted: { fontSize: 12, fontWeight: '400' as const, color: c.inkMuted, lineHeight: 16 },
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
