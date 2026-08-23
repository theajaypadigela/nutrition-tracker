/**
 * Nourish auth design tokens — the React Native port of the Claude Design
 * `auth-data.jsx` `AUTH_TOKENS` palette. Shared by every auth/onboarding screen
 * and primitive so the look stays consistent. Plain values (not NativeWind) because
 * the design relies on precise gradients, focus rings, and radii.
 * Color values come from the shared token source (src/theme/tokens.ts).
 */
import { authNeutral, authStatus, brandGreen, neutral } from '@/theme/tokens';

export const T = {
  ink: authNeutral.ink,
  inkSoft: authNeutral.inkSoft,
  inkMuted: authNeutral.inkMuted,
  line: authNeutral.line,
  lineSoft: authNeutral.lineSoft,
  field: authNeutral.field,
  surface: neutral.white,
  bg: authNeutral.bg,
  // brand green
  green: brandGreen.base,
  greenMid: brandGreen.mid,
  greenDeep: brandGreen.deep,
  greenDark: brandGreen.dark,
  greenSoft: brandGreen.soft,
  greenSoft2: brandGreen.soft2,
  // status
  danger: authStatus.danger,
  dangerSoft: authStatus.dangerSoft,
  warn: authStatus.warn,
  warnSoft: authStatus.warnSoft,
  ok: authStatus.ok,
  white: neutral.white,
} as const;

/** Corner radii, mirroring the design's `--r-*` scale (base 16). */
export const R = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export interface PwStrength {
  score: number;
  label: string;
  color: string;
  pct: number;
}

/** Password strength heuristic, ported from the design's `pwStrength`. */
export function pwStrength(pw: string): PwStrength {
  if (!pw) return { score: 0, label: '', color: authStatus.strengthEmpty, pct: 0 };
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (pw.length >= 12 && s >= 3) s = 4;
  const map: PwStrength[] = [
    { score: 0, label: 'Too weak', color: T.danger, pct: 0.18 },
    { score: 1, label: 'Weak', color: T.danger, pct: 0.34 },
    { score: 2, label: 'Fair', color: T.warn, pct: 0.6 },
    { score: 3, label: 'Good', color: T.green, pct: 0.82 },
    { score: 4, label: 'Strong', color: T.green, pct: 1 },
  ];
  return { ...map[s], score: s };
}

/** Format an ISO `yyyy-MM-dd` date as e.g. "May 15, 2000" for display. */
export function formatDob(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
