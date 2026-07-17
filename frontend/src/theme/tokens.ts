/**
 * Single source of design-token color values for the app's themed surfaces.
 *
 * Each surface theme — `callTheme` (dark call experience), the auth `T` palette,
 * the weekly-report `tokens`, and the nutrition-report chart constants — maps these
 * values into its existing exported shape, so importers and rendered pixels are
 * unchanged. Where surfaces intentionally use different shades of the "same" hue
 * (brand green #0f7a3d vs report green #0e9b6d, etc.) they keep distinct semantic
 * tokens here — do not merge them.
 */

/** Neutrals shared across the light (auth + report) surfaces. */
export const neutral = {
  white: '#ffffff',
} as const;

/** Auth/onboarding brand green scale (Nourish `AUTH_TOKENS`). */
export const brandGreen = {
  base: '#0f7a3d',
  mid: '#1b9750',
  deep: '#0a4d27',
  dark: '#06351b',
  soft: '#e6f4ec',
  soft2: '#d6ecdf',
} as const;

/** Auth/onboarding surface neutrals (warm green-tinted grays). */
export const authNeutral = {
  ink: '#0d1f16',
  inkSoft: '#48584f',
  inkMuted: '#8a988f',
  line: '#e3eae5',
  lineSoft: '#eef3f0',
  field: '#f5f8f6',
  bg: '#eaf0ec',
} as const;

/** Auth/onboarding status + feedback colors. */
export const authStatus = {
  danger: '#d24b4b',
  dangerSoft: '#fcecec',
  warn: '#cf8a1a',
  warnSoft: '#fbf1dd',
  ok: '#0f9b54',
  /** Empty password-strength meter track. */
  strengthEmpty: '#cdd6d0',
} as const;

/** Weekly nutrition report accent blue. */
export const reportBlue = {
  base: '#1769d6',
  soft: '#e7f0fc',
  deep: '#0a3a82',
} as const;

/** Weekly nutrition report health/"good" green — distinct from `brandGreen`. */
export const reportGreen = {
  base: '#0e9b6d',
  deep: '#06624a',
  soft: '#dff5ec',
} as const;

/** Weekly nutrition report surface neutrals (cool blue-tinted grays). */
export const reportNeutral = {
  ink: '#0c1b22',
  inkSoft: '#4a5d68',
  inkMuted: '#7a8a93',
  bg: '#f4f8fa',
  line: '#e3ebef',
  lineSoft: '#eef2f5',
} as const;

/** Weekly nutrition report status colors (warn/bad; "good" is `reportGreen`). */
export const reportStatus = {
  warn: '#d98a16',
  warnSoft: '#fbf0db',
  bad: '#dc3545',
  badSoft: '#fbe5e7',
} as const;

/** Weekly report header gradient (deep blues). */
export const reportHeaderGradient = ['#0d4ea8', '#0a3a82', '#062a63'] as const;

/** Macro chart accents (daily nutrition report cards). */
export const macroAccent = {
  protein: '#3b82f6',
  carbs: '#f59e0b',
  fats: '#a855f7',
} as const;

/** Micro-nutrient card accents: icon / icon surface / deep text per nutrient. */
export const microAccent = {
  sugar: '#f43f5e',
  sugarSurface: '#ffe4e6',
  sugarDeep: '#be123c',
  fiber: '#10b981',
  fiberSurface: '#dcfce7',
  fiberDeep: '#15803d',
  sodium: '#f97316',
  sodiumSurface: '#ffedd5',
  sodiumDeep: '#c2410c',
  statusGoodSurface: '#dcfce7',
  statusGoodText: '#15803d',
  statusWarnSurface: '#fef3c7',
  statusWarnText: '#b45309',
} as const;

/** Dark, continuous call-experience palette (see callTheme.ts for rationale). */
export const callPalette = {
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
