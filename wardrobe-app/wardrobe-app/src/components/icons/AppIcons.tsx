// src/components/icons/AppIcons.tsx
//
// Replaces every remaining Ionicons glyph in the app with a hand-drawn
// equivalent at a flat 1.5 stroke — the same weight FigmaIcon and
// SuperBaeIcons were just normalized to. Ionicons are font glyphs with
// no adjustable stroke, which is exactly why they always looked
// heavier/lighter than the rest of the icon set no matter what size
// was passed in.
//
// These are NOT pulled from the SuperBae Figma file — Figma access is
// rate-limited on this account right now (see the note sent alongside
// this change), so redrawing from the real source wasn't possible.
// Each icon here is a plain, generic geometric symbol (circle, tag,
// calendar, etc.) built from simple shapes, deliberately avoiding any
// particular icon library's exact glyph design. If/when Figma access
// is back, these are a straightforward swap for the real exports.
import React from 'react';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

export type AppIconName =
  | 'checkmarkCircle' | 'briefcase' | 'tag' | 'image' | 'clipboard'
  | 'chevronForward' | 'swapVertical' | 'sparkles' | 'shirt' | 'share'
  | 'search' | 'refresh' | 'location' | 'fileTray' | 'colorPalette'
  | 'calendar' | 'body' | 'attach' | 'arrowForward' | 'home' | 'chatBubble' | 'albums'
  | 'cash' | 'resize' | 'partlySunny' | 'repeat' | 'trendingDown' | 'mic' | 'recordDot';

interface AppIconProps {
  name: AppIconName;
  size?: number;
  color?: string;
}

export function AppIcon({ name, size = 24, color = '#1A1A1A' }: AppIconProps) {
  const s = { stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'checkmarkCircle' && (
        <>
          <Circle cx={12} cy={12} r={9} {...s} />
          <Path d="M8 12.5L10.5 15L16 9" {...s} />
        </>
      )}

      {name === 'briefcase' && (
        <>
          <Path d="M9 7V5.5C9 4.67 9.67 4 10.5 4H13.5C14.33 4 15 4.67 15 5.5V7" {...s} />
          <Path d="M4 8.5C4 7.67 4.67 7 5.5 7H18.5C19.33 7 20 7.67 20 8.5V18.5C20 19.33 19.33 20 18.5 20H5.5C4.67 20 4 19.33 4 18.5V8.5Z" {...s} />
          <Line x1={4} y1={13} x2={20} y2={13} {...s} />
        </>
      )}

      {name === 'tag' && (
        <>
          <Path d="M11.5 3H5.5C4.67 3 4 3.67 4 4.5V10.5C4 10.9 4.16 11.28 4.44 11.56L12.44 19.56C13.02 20.15 13.98 20.15 14.56 19.56L19.56 14.56C20.15 13.98 20.15 13.02 19.56 12.44L11.56 4.44C11.28 4.16 10.9 4 10.5 4" {...s} />
          <Circle cx={7.5} cy={7.5} r={1} fill={color} />
        </>
      )}

      {name === 'image' && (
        <>
          <Path d="M4.5 5H19.5C20.05 5 20.5 5.45 20.5 6V18C20.5 18.55 20.05 19 19.5 19H4.5C3.95 19 3.5 18.55 3.5 18V6C3.5 5.45 3.95 5 4.5 5Z" {...s} />
          <Circle cx={9} cy={10} r={1.5} {...s} />
          <Path d="M20.5 16L16 11.5L6.5 19" {...s} />
        </>
      )}

      {name === 'clipboard' && (
        <>
          <Path d="M6.5 5.5H17.5C18.05 5.5 18.5 5.95 18.5 6.5V19.5C18.5 20.05 18.05 20.5 17.5 20.5H6.5C5.95 20.5 5.5 20.05 5.5 19.5V6.5C5.5 5.95 5.95 5.5 6.5 5.5Z" {...s} />
          <Path d="M9.5 4C9.5 3.45 9.95 3 10.5 3H13.5C14.05 3 14.5 3.45 14.5 4V6H9.5V4Z" {...s} />
        </>
      )}

      {name === 'chevronForward' && <Path d="M9 6L15 12L9 18" {...s} />}

      {name === 'swapVertical' && (
        <>
          <Path d="M8 4V17M8 4L4.5 7.5M8 4L11.5 7.5" {...s} />
          <Path d="M16 20V7M16 20L19.5 16.5M16 20L12.5 16.5" {...s} />
        </>
      )}

      {name === 'sparkles' && (
        <>
          <Path d="M12 4L13.2 8.8L18 10L13.2 11.2L12 16L10.8 11.2L6 10L10.8 8.8L12 4Z" {...s} strokeLinejoin="round" />
        </>
      )}

      {name === 'shirt' && (
        <Path d="M8.5 4L4 6.5V10H7V19.5H17V10H20V6.5L15.5 4L14 5.5H10L8.5 4Z" {...s} />
      )}

      {name === 'share' && (
        <>
          <Circle cx={6} cy={12} r={2} {...s} />
          <Circle cx={18} cy={6} r={2} {...s} />
          <Circle cx={18} cy={18} r={2} {...s} />
          <Line x1={7.8} y1={11} x2={16.2} y2={7} {...s} />
          <Line x1={7.8} y1={13} x2={16.2} y2={17} {...s} />
        </>
      )}

      {name === 'search' && (
        <>
          <Circle cx={11} cy={11} r={6.5} {...s} />
          <Line x1={15.8} y1={15.8} x2={20.5} y2={20.5} {...s} />
        </>
      )}

      {name === 'refresh' && (
        <>
          <Path d="M20 11A8 8 0 105.5 16.5" {...s} />
          <Polyline points="20,5 20,11 14,11" {...s} />
        </>
      )}

      {name === 'location' && (
        <>
          <Path d="M12 21C12 21 18.5 14.86 18.5 10A6.5 6.5 0 105.5 10C5.5 14.86 12 21 12 21Z" {...s} />
          <Circle cx={12} cy={10} r={2.2} {...s} />
        </>
      )}

      {name === 'fileTray' && (
        <>
          <Polyline points="3.5,13 6.5,5 17.5,5 20.5,13" {...s} />
          <Path d="M3.5 13H8C8.3 14.15 9.5 15 11 15H13C14.5 15 15.7 14.15 16 13H20.5V18.5C20.5 19.05 20.05 19.5 19.5 19.5H4.5C3.95 19.5 3.5 19.05 3.5 18.5V13Z" {...s} />
        </>
      )}

      {name === 'colorPalette' && (
        <>
          <Path d="M12 3.5C7.3 3.5 3.5 7.3 3.5 12C3.5 16.7 7.3 20.5 12 20.5C13 20.5 13.5 19.7 13.5 19C13.5 18.6 13.35 18.25 13.1 18C12.85 17.75 12.7 17.4 12.7 17C12.7 16.3 13.3 15.7 14 15.7H16C18.5 15.7 20.5 13.7 20.5 11.2C20.5 6.9 16.7 3.5 12 3.5Z" {...s} />
          <Circle cx={7.5} cy={11} r={1.1} fill={color} />
          <Circle cx={9.5} cy={7.5} r={1.1} fill={color} />
          <Circle cx={14.5} cy={7.5} r={1.1} fill={color} />
          <Circle cx={17} cy={11} r={1.1} fill={color} />
        </>
      )}

      {name === 'calendar' && (
        <>
          <Path d="M5 5H19C19.55 5 20 5.45 20 6V19C20 19.55 19.55 20 19 20H5C4.45 20 4 19.55 4 19V6C4 5.45 4.45 5 5 5Z" {...s} />
          <Line x1={4} y1={10} x2={20} y2={10} {...s} />
          <Line x1={8} y1={3} x2={8} y2={7} {...s} />
          <Line x1={16} y1={3} x2={16} y2={7} {...s} />
        </>
      )}

      {name === 'body' && (
        <>
          <Circle cx={12} cy={6} r={3} {...s} />
          <Path d="M6 21V17.5C6 14.46 8.46 12 11.5 12H12.5C15.54 12 18 14.46 18 17.5V21" {...s} />
        </>
      )}

      {name === 'attach' && (
        <Path d="M17.5 7L10 14.5C8.9 15.6 8.9 17.4 10 18.5C11.1 19.6 12.9 19.6 14 18.5L20 12.5C21.66 10.84 21.66 8.16 20 6.5C18.34 4.84 15.66 4.84 14 6.5L8 12.5C5.79 14.71 5.79 18.29 8 20.5" {...s} />
      )}

      {name === 'arrowForward' && (
        <>
          <Line x1={4} y1={12} x2={18.5} y2={12} {...s} />
          <Path d="M13 6.5L19 12L13 17.5" {...s} />
        </>
      )}

      {name === 'home' && (
        <>
          <Path d="M4.5 11L12 4.5L19.5 11" {...s} />
          <Path d="M6.5 9.5V19C6.5 19.55 6.95 20 7.5 20H16.5C17.05 20 17.5 19.55 17.5 19V9.5" {...s} />
          <Line x1={10} y1={20} x2={10} y2={15} {...s} />
        </>
      )}

      {name === 'chatBubble' && (
        <Path d="M4 5.5H20V16H10L6 19.5V16H4V5.5Z" {...s} />
      )}

      {name === 'albums' && (
        <>
          <Path d="M6 8H4.5C3.95 8 3.5 8.45 3.5 9V19C3.5 19.55 3.95 20 4.5 20H15C15.55 20 16 19.55 16 19V17.5" {...s} />
          <Path d="M8.5 4H19.5C20.05 4 20.5 4.45 20.5 5V15C20.5 15.55 20.05 16 19.5 16H8.5C7.95 16 7.5 15.55 7.5 15V5C7.5 4.45 7.95 4 8.5 4Z" {...s} />
        </>
      )}

      {name === 'cash' && (
        <>
          <Path d="M2.5 6.5H21.5C22.05 6.5 22.5 6.95 22.5 7.5V16.5C22.5 17.05 22.05 17.5 21.5 17.5H2.5C1.95 17.5 1.5 17.05 1.5 16.5V7.5C1.5 6.95 1.95 6.5 2.5 6.5Z" {...s} />
          <Circle cx={12} cy={12} r={2.5} {...s} />
        </>
      )}

      {name === 'resize' && (
        <>
          <Path d="M15 4H20V9" {...s} />
          <Path d="M9 20H4V15" {...s} />
          <Line x1={20} y1={4} x2={13} y2={11} {...s} />
          <Line x1={4} y1={20} x2={11} y2={13} {...s} />
        </>
      )}

      {name === 'partlySunny' && (
        <>
          <Circle cx={9} cy={8} r={3.2} {...s} />
          <Line x1={9} y1={2.3} x2={9} y2={3.6} {...s} />
          <Line x1={3.8} y1={8} x2={5.1} y2={8} {...s} />
          <Line x1={4.6} y1={3.6} x2={5.5} y2={4.5} {...s} />
          <Path d="M8.5 14.5H18C19.38 14.5 20.5 15.62 20.5 17C20.5 18.38 19.38 19.5 18 19.5H7C5.34 19.5 4 18.16 4 16.5C4 15.02 5.07 13.79 6.47 13.55" {...s} />
        </>
      )}

      {name === 'repeat' && (
        <>
          <Path d="M4 8H16C17.66 8 19 9.34 19 11V12.5" {...s} />
          <Path d="M20 16H8C6.34 16 5 14.66 5 13V11.5" {...s} />
          <Path d="M6.5 5.5L4 8L6.5 10.5" {...s} />
          <Path d="M17.5 13.5L20 16L17.5 18.5" {...s} />
        </>
      )}

      {name === 'trendingDown' && (
        <>
          <Polyline points="3,7 10,14 14,10 21,17" {...s} />
          <Polyline points="21,10.5 21,17 14.5,17" {...s} />
        </>
      )}

      {name === 'mic' && (
        <>
          <Path d="M12 15C13.66 15 15 13.66 15 12V6C15 4.34 13.66 3 12 3C10.34 3 9 4.34 9 6V12C9 13.66 10.34 15 12 15Z" {...s} />
          <Path d="M5.5 11V12C5.5 15.59 8.41 18.5 12 18.5C15.59 18.5 18.5 15.59 18.5 12V11" {...s} />
          <Line x1={12} y1={18.5} x2={12} y2={21.5} {...s} />
        </>
      )}

      {name === 'recordDot' && <Circle cx={12} cy={12} r={7} fill={color} />}
    </Svg>
  );
}
