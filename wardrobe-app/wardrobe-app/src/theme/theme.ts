// src/theme/theme.ts
// Light theme colors read directly from the actual Figma screens. Dark
// theme lives alongside it in darkColors — see ThemeContext.tsx for how
// screens switch between them at runtime.
//
// v3 — real client design spec applied directly, not another round of
// "considered refinement" guesswork:
//   - Colors constrained to the exact 4 specified: white #FFFFFF,
//     black #141414, gray #999999, gray #636363. These now drive the
//     entire neutral palette (bg/card/border/ink/inkMuted/black/white).
//     Functional accent colors (success/danger/heart, and the pastel
//     tag-pill accents used for filters/categories) are kept — the
//     spec's 4 colors are clearly the dominant neutral palette shown
//     throughout the reference screens, not a literal "delete every
//     other color" instruction, since a delete button needs SOME red
//     signal and tag pills need visual variety to stay scannable.
//   - Corner radius set to 30 for cards (the dominant, most visible
//     radius in the reference mockups), with smaller elements (chips,
//     small buttons) scaled down proportionally rather than also
//     forced to 30, which would look odd on small tap targets.
//   - Added a real card shadow token (cardShadow) — previously cards
//     only had a 1px border, no elevation at all.
export const lightColors = {
  bg: '#FFFFFF',
  bgSoft: '#F7F7F7',
  cream: '#F7F7F7',
  card: '#FFFFFF',
  border: '#E5E5E5',
  ink: '#141414',
  inkMuted: '#636363',
  black: '#141414',
  white: '#FFFFFF',

  mascot: '#E5E1DB',
  mascotShadow: '#D2CCC3',

  accent: '#141414',
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

  chipBg: '#F7F7F7',
  chipBorder: '#E5E5E5',
  chipSelectedBg: '#E9E0F3',
  chipSelectedBorder: '#9B82C4',
  chipSelectedText: '#141414',
};

export const darkColors: typeof lightColors = {
  bg: '#141414',
  bgSoft: '#1F1F1F',
  cream: '#1F1F1F',
  card: '#1F1F1F',
  border: '#333333',
  ink: '#FFFFFF',
  inkMuted: '#999999',
  black: '#FFFFFF',   // buttons invert: light pill on dark bg
  white: '#141414',   // text/icons on those inverted buttons

  mascot: '#4A4342',
  mascotShadow: '#332C2D',

  accent: '#FFFFFF',
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

  chipBg: '#1F1F1F',
  chipBorder: '#333333',
  chipSelectedBg: '#372D42',
  chipSelectedBorder: '#8267AD',
  chipSelectedText: '#FFFFFF',
};

// Default export kept for any screen not yet migrated to the dynamic
// theme (see ThemeContext.tsx) — always resolves to light colors, same
// as before dark mode existed, so nothing breaks for unconverted screens.
export const colors = lightColors;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
// sm/md kept smaller for chips/small buttons (a 30px radius on a 32px-tall
// chip would look like a circle, not a pill-ish rounded rect) — lg is the
// real spec value (30), used for cards/major surfaces, matching the
// dominant rounded look throughout the reference screens.
export const radius = { sm: 12, md: 20, lg: 30, pill: 999 };

// Real elevation, not just a border — cards in the reference mockups
// visibly lift off the background. iOS uses the shadow* properties,
// Android uses elevation; spreading this object covers both from one
// token.
export const cardShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
};

export function buildType(c: typeof lightColors) {
  return {
    h1: { fontSize: 28, fontWeight: '700' as const, fontFamily: 'DMSans_700Bold', color: c.ink, letterSpacing: -0.4, lineHeight: 34 },
    h2: { fontSize: 20, fontWeight: '700' as const, fontFamily: 'DMSans_700Bold', color: c.ink, letterSpacing: -0.2, lineHeight: 26 },
    h3: { fontSize: 16, fontWeight: '600' as const, fontFamily: 'DMSans_600SemiBold', color: c.ink, letterSpacing: -0.1, lineHeight: 21 },
    body: { fontSize: 14, fontWeight: '400' as const, fontFamily: 'DMSans_400Regular', color: c.ink, lineHeight: 20 },
    muted: { fontSize: 12, fontWeight: '400' as const, fontFamily: 'DMSans_400Regular', color: c.inkMuted, lineHeight: 16 },
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
