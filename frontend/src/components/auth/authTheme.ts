/**
 * Nourish auth design tokens — the React Native port of the Claude Design
 * `auth-data.jsx` `AUTH_TOKENS` palette. Shared by every auth/onboarding screen
 * and primitive so the look stays consistent. Plain values (not NativeWind) because
 * the design relies on precise gradients, focus rings, and radii.
 */
export const T = {
  ink: '#0d1f16',
  inkSoft: '#48584f',
  inkMuted: '#8a988f',
  line: '#e3eae5',
  lineSoft: '#eef3f0',
  field: '#f5f8f6',
  surface: '#ffffff',
  bg: '#eaf0ec',
  // brand green
  green: '#0f7a3d',
  greenMid: '#1b9750',
  greenDeep: '#0a4d27',
  greenDark: '#06351b',
  greenSoft: '#e6f4ec',
  greenSoft2: '#d6ecdf',
  // status
  danger: '#d24b4b',
  dangerSoft: '#fcecec',
  warn: '#cf8a1a',
  warnSoft: '#fbf1dd',
  ok: '#0f9b54',
  white: '#ffffff',
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
  if (!pw) return { score: 0, label: '', color: '#cdd6d0', pct: 0 };
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

/** Format an hour/minute pair as a 12-hour time string, e.g. "8:00 PM". */
export function formatTime(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
