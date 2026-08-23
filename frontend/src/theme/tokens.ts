/**
 * The app's design tokens — one scale, namespaced per surface.
 *
 * `tokens` is the only export. Reach a colour as `tokens.<surface>.<role>` and you
 * are one hop from its hex value. Before this, the same colour was reachable three
 * ways — `brandGreen.base`, `authTheme.T.green`, and a literal — because each
 * surface re-exported this module under its own names. Those views are gone; the
 * per-surface modules now keep only what is genuinely theirs (radii, fonts,
 * gradient stops, status logic).
 *
 * The raw palettes below stay separate and private, because the surfaces
 * intentionally use different shades of the "same" hue (brand green #0f7a3d vs
 * report green #0e9b6d, etc.). **Do not merge them.**
 */

/** Neutrals shared across the light (auth + report) surfaces. */
const neutral = {
  white: '#ffffff',
} as const;

/** Auth/onboarding brand green scale (Nourish `AUTH_TOKENS`). */
const brandGreen = {
  base: '#0f7a3d',
  mid: '#1b9750',
  deep: '#0a4d27',
  dark: '#06351b',
  soft: '#e6f4ec',
  soft2: '#d6ecdf',
} as const;

/** Auth/onboarding surface neutrals (warm green-tinted grays). */
const authNeutral = {
  ink: '#0d1f16',
  inkSoft: '#48584f',
  inkMuted: '#8a988f',
  line: '#e3eae5',
  lineSoft: '#eef3f0',
  field: '#f5f8f6',
  bg: '#eaf0ec',
} as const;

/** Auth/onboarding status + feedback colors. */
const authStatus = {
  danger: '#d24b4b',
  dangerSoft: '#fcecec',
  warn: '#cf8a1a',
  warnSoft: '#fbf1dd',
  ok: '#0f9b54',
  /** Empty password-strength meter track. */
  strengthEmpty: '#cdd6d0',
} as const;

/** Weekly nutrition report accent blue. */
const reportBlue = {
  base: '#1769d6',
  soft: '#e7f0fc',
  deep: '#0a3a82',
} as const;

/** Weekly nutrition report health/"good" green — distinct from `brandGreen`. */
const reportGreen = {
  base: '#0e9b6d',
  deep: '#06624a',
  soft: '#dff5ec',
} as const;

/** Weekly nutrition report surface neutrals (cool blue-tinted grays). */
const reportNeutral = {
  ink: '#0c1b22',
  inkSoft: '#4a5d68',
  inkMuted: '#7a8a93',
  bg: '#f4f8fa',
  line: '#e3ebef',
  lineSoft: '#eef2f5',
} as const;

/** Weekly nutrition report status colors (warn/bad; "good" is `reportGreen`). */
const reportStatus = {
  warn: '#d98a16',
  warnSoft: '#fbf0db',
  bad: '#dc3545',
  badSoft: '#fbe5e7',
} as const;

/** Weekly report header gradient (deep blues). */
const reportHeaderGradient = ['#0d4ea8', '#0a3a82', '#062a63'] as const;

/** Macro chart accents (daily nutrition report cards). */
const macroAccent = {
  protein: '#3b82f6',
  carbs: '#f59e0b',
  fats: '#a855f7',
} as const;

/** Micro-nutrient card accents: icon / icon surface / deep text per nutrient. */
const microAccent = {
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
const callPalette = {
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

/**
 * The public scale. Member names are the ones each surface already used, so a
 * reader moving from `T.greenSoft` to `tokens.auth.greenSoft` sees the same word.
 */
export const tokens = {
  /** Auth + onboarding screens (light, warm green-tinted). */
  auth: {
    ink: authNeutral.ink,
    inkSoft: authNeutral.inkSoft,
    inkMuted: authNeutral.inkMuted,
    line: authNeutral.line,
    lineSoft: authNeutral.lineSoft,
    field: authNeutral.field,
    surface: neutral.white,
    bg: authNeutral.bg,
    green: brandGreen.base,
    greenMid: brandGreen.mid,
    greenDeep: brandGreen.deep,
    greenDark: brandGreen.dark,
    greenSoft: brandGreen.soft,
    greenSoft2: brandGreen.soft2,
    danger: authStatus.danger,
    dangerSoft: authStatus.dangerSoft,
    warn: authStatus.warn,
    warnSoft: authStatus.warnSoft,
    ok: authStatus.ok,
    strengthEmpty: authStatus.strengthEmpty,
    white: neutral.white,
  },

  /** Weekly nutrition report (light, cool blue-tinted). */
  report: {
    ink: reportNeutral.ink,
    inkSoft: reportNeutral.inkSoft,
    inkMuted: reportNeutral.inkMuted,
    surface: neutral.white,
    bg: reportNeutral.bg,
    line: reportNeutral.line,
    lineSoft: reportNeutral.lineSoft,
    primary: reportBlue.base,
    primarySoft: reportBlue.soft,
    primaryDeep: reportBlue.deep,
    green: reportGreen.base,
    greenDeep: reportGreen.deep,
    greenSoft: reportGreen.soft,
    good: reportGreen.base,
    goodSoft: reportGreen.soft,
    warn: reportStatus.warn,
    warnSoft: reportStatus.warnSoft,
    bad: reportStatus.bad,
    badSoft: reportStatus.badSoft,
    headerGradient: reportHeaderGradient,
  },

  /**
   * The food-log surface (meal cards, check-in card, macro card, day header).
   * A warm green-tinted scale that was declared THREE times in raw hex —
   * MealGroup's local `T`, MacrosCard's local `T`, and CheckinCard's
   * GREEN/LINE/INK consts — with the same values each time.
   */
  foodLog: {
    ink: '#16241c',
    inkSoft: '#52635a',
    inkMuted: authNeutral.inkMuted,
    line: '#e7ede9',
    lineSoft: '#f1f5f2',
    bg: '#eef2f0',
    surface: neutral.white,
    green: brandGreen.base,
    greenMid: brandGreen.mid,
    greenSoft: brandGreen.soft,
    /** Deliberately NOT brandGreen.deep (#0a4d27) — the day header runs darker. */
    greenDeep: '#0a5226',
    /** Top stop of the day-header gradient. */
    greenBright: '#14914a',
    good: '#0f9b54',
    goodSoft: '#e3f5ea',
    warn: '#d98a16',
    warnSoft: '#fbf0db',
    low: '#e0573e',
    lowSoft: '#fdeae3',
    purple: '#7c3aed',
    purpleSoft: '#f0e9fb',
    blue: '#2a64c4',
    blueSoft: '#e7eefb',
    amber: '#e08a16',
    amberSoft: '#fff1d9',
    shadow: '#102818',
    switchTrackOff: authStatus.strengthEmpty,
    switchThumb: neutral.white,
    // "your log may be out of date" banner
    staleBg: '#fffbeb',
    staleLine: '#fde68a',
    staleInk: '#b45309',
    staleInkSoft: '#92400e',
    staleIcon: '#d97706',
    headerGradient: ['#14914a', brandGreen.base, '#0a5226'],
  },

  /**
   * The dashboard and app chrome (AppBar, BottomNavigation, calendar, habit and
   * meal-slot cards). An emerald + slate scale, distinct from `foodLog`'s warm
   * greens and from `auth`'s brand green.
   *
   * It carries TWO near-identical neutral ramps on purpose: `ink`/`inkSoft`/
   * `inkMuted` are the slate ramp the chrome uses, and `calendar*` are the gray
   * ramp react-native-calendars was configured with. #0f172a vs #111827 and
   * #94a3b8 vs #6b7280 are one step apart — **do not merge them** without
   * re-checking the calendar against the rest of the chrome.
   */
  dashboard: {
    surface: neutral.white,
    green: '#059669',
    greenDeep: '#047857',
    greenDeepest: '#065f46',
    greenBright: '#10b981',
    greenAccent: '#0ea371',
    teal: '#0f766e',
    ink: '#0f172a',
    inkSoft: '#64748b',
    inkMuted: '#94a3b8',
    /** AppBar hairline. */
    line: '#e4f1ea',
    /** Chip / avatar-well border. */
    lineTint: '#d5e8dd',
    /** Chip / avatar-well fill. */
    bgTint: '#f4faf7',
    /** BottomNavigation hairline. */
    navLine: '#dceadf',
    /** Back-chevron ink — a step off `ink`, kept as it was. */
    chevron: '#1f2937',
    calendarInk: '#111827',
    calendarInkMuted: '#6b7280',
    calendarInkDisabled: '#d1d5db',
  },

  /**
   * Icon accents shared by the habit screens. Tailwind steps, used only to tint
   * glyphs — no surfaces are painted with these.
   */
  icon: {
    green: '#059669',
    blue: '#3b82f6',
    amber: '#d97706',
    violet: '#7c3aed',
    red: '#ef4444',
    /** Placeholder text and inactive glyphs. */
    muted: '#9ca3af',
    /** One step darker than `muted`; the unselected reminder-type glyph. */
    mutedStrong: '#6b7280',
    onAccent: neutral.white,
  },

  /** The dark, continuous call experience. */
  call: callPalette,

  /** Macro chart accents. */
  macro: macroAccent,

  /** Micro-nutrient card accents. */
  micro: microAccent,
} as const;
