/**
 * Shared design tokens for the unified "call" experience — the incoming-call banner, the
 * full-screen incoming call, and the in-call voice session screen all draw from here so the
 * three surfaces stay in lockstep. Previously the incoming-call surface was dark
 * (#0A0A0A, iOS-call styling) and the in-call screen was light (#eef3f8 / blue), so the
 * call visually "flipped" the instant you accepted. One token set fixes that.
 *
 * This module is the SINGLE switch point for the call look. The palette (tokens.ts
 * `callPalette`) is the dark, continuous-call theme; to move the whole experience to a
 * light theme, change the values there once and both surfaces follow — no per-component
 * edits.
 */

import { Platform } from 'react-native';
import { callPalette } from './tokens';

export const callFontFamily = Platform.select({
  ios: 'SF Pro Text',
  android: 'sans-serif',
});

// Color values live in tokens.ts (`callPalette`) alongside the other surfaces' tokens.
export const callColors = callPalette;

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
