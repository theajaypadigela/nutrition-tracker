/**
 * Shared design tokens for the unified "call" experience — the incoming-call banner, the
 * full-screen incoming call, and the in-call voice session screen all draw from here so the
 * three surfaces stay in lockstep. Previously the incoming-call surface was dark
 * (#0A0A0A, iOS-call styling) and the in-call screen was light (#eef3f8 / blue), so the
 * call visually "flipped" the instant you accepted. One token set fixes that.
 *
 * This module is the SINGLE switch point for the call look. The palette below is the dark,
 * continuous-call theme; to move the whole experience to a light theme, change the values
 * here once and both surfaces follow — no per-component edits.
 */

import { Platform } from 'react-native';

export const callFontFamily = Platform.select({
  ios: 'SF Pro Text',
  android: 'sans-serif',
});

export const callColors = {
  // Surfaces (darkest → most elevated)
  background: '#0A0A0A',
  surface: '#111111',
  surfaceElevated: '#1A1A1A',
  surfaceAvatar: '#1E1E2E',
  border: '#222222',

  // Text
  textPrimary: '#F3F3F3',
  textSecondary: '#C9C9C9',
  textMuted: '#8B8B92',
  textFaint: '#555555',

  // Brand / AI accent (the avatar glyph + active-state accents)
  brand: '#7F77DD',
  brandSoft: '#2A2740',

  // Call actions
  accept: '#1D9E75',
  acceptSurface: '#0A2A1A',
  decline: '#E24B4A',
  declineSurface: '#2A0A0A',
  presence: '#1D9E75',

  // Status / feedback
  warning: '#D9A441',
  warningSurface: '#2A210A',

  // Transcript bubbles
  bubbleAssistant: '#1A1A1A',
  bubbleAssistantBorder: '#262626',
  bubbleUser: '#3A348F',
  bubbleUserBorder: '#4B45A8',
  onBubbleAssistant: '#ECECEC',
  onBubbleUser: '#FFFFFF',

  onAccent: '#FFFFFF',
} as const;

export const callRadius = {
  pill: 999,
  lg: 20,
  md: 16,
  sm: 12,
} as const;

export const callSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
} as const;

/** Convenience bundle so call surfaces can `import { callTheme }` once. */
export const callTheme = {
  font: callFontFamily,
  color: callColors,
  radius: callRadius,
  spacing: callSpacing,
} as const;
