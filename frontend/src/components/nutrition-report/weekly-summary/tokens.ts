import {
  neutral,
  reportBlue,
  reportGreen,
  reportHeaderGradient,
  reportNeutral,
  reportStatus,
} from '@/theme/tokens';
import { Direction, Status, WeeklyNutrient } from '@/types/nutrition';
import { getMondayWeekRange } from '@/utils/weekRange';
import { DAY_CODES_MONDAY_FIRST } from '@/utils/dayCode';

// Color values live in the shared token source (src/theme/tokens.ts).
export const tokens = {
  // text
  ink: reportNeutral.ink,
  inkSoft: reportNeutral.inkSoft,
  inkMuted: reportNeutral.inkMuted,
  // surfaces & lines
  surface: neutral.white,
  bg: reportNeutral.bg,
  line: reportNeutral.line,
  lineSoft: reportNeutral.lineSoft,
  // brand blue
  primary: reportBlue.base,
  primarySoft: reportBlue.soft,
  primaryDeep: reportBlue.deep,
  // brand green (health / good)
  green: reportGreen.base,
  greenDeep: reportGreen.deep,
  greenSoft: reportGreen.soft,
  // status
  good: reportGreen.base,
  goodSoft: reportGreen.soft,
  warn: reportStatus.warn,
  warnSoft: reportStatus.warnSoft,
  bad: reportStatus.bad,
  badSoft: reportStatus.badSoft,
} as const;

export const headerGradient = reportHeaderGradient;
export const headerGradientLocations = [0, 0.55, 1] as const;

export const statusColorMap: Record<Status, { fg: string; bg: string }> = {
  good: { fg: tokens.good, bg: tokens.goodSoft },
  warn: { fg: tokens.warn, bg: tokens.warnSoft },
  bad: { fg: tokens.bad, bg: tokens.badSoft },
};

export function statusOf(n: Pick<WeeklyNutrient, 'amount' | 'goal' | 'dir'>): Status {
  if (!n.goal || n.goal <= 0) return 'warn';
  const pct = n.amount / n.goal;
  if (n.dir === 'higher') {
    if (pct >= 1.0) return 'good';
    if (pct >= 0.8) return 'warn';
    return 'bad';
  }
  if (n.dir === 'lower') {
    if (pct <= 1.0) return 'good';
    if (pct <= 1.15) return 'warn';
    return 'bad';
  }
  if (pct >= 0.9 && pct <= 1.1) return 'good';
  if (pct >= 0.75 && pct <= 1.25) return 'warn';
  return 'bad';
}

export function statusLabel(n: Pick<WeeklyNutrient, 'amount' | 'goal' | 'dir'>): string {
  const s = statusOf(n);
  if (n.dir === 'higher') {
    if (s === 'good') return 'GOAL MET';
    if (s === 'warn') return 'ALMOST THERE';
    return 'BELOW GOAL';
  }
  if (n.dir === 'lower') {
    if (s === 'good') return 'WITHIN LIMIT';
    if (s === 'warn') return 'WATCH OUT';
    return 'OVER LIMIT';
  }
  if (s === 'good') return 'IN RANGE';
  if (s === 'warn') return 'CLOSE';
  return 'OUT OF RANGE';
}

export function helperText(dir: Direction): string {
  if (dir === 'higher') return 'Aim higher · weekly';
  if (dir === 'lower') return 'Keep low · weekly';
  return 'Stay in range · weekly';
}

export function scoreOf(nutrients: WeeklyNutrient[]): number {
  if (!nutrients.length) return 0;
  const total = nutrients.reduce((acc, n) => {
    const s = statusOf(n);
    return acc + (s === 'good' ? 100 : s === 'warn' ? 70 : 30);
  }, 0);
  return Math.round(total / nutrients.length);
}

export function verdictOf(score: number): string {
  if (score >= 90) return 'Excellent week';
  if (score >= 80) return 'Strong week';
  if (score >= 70) return 'Good, room to grow';
  if (score >= 60) return 'Mixed week';
  return 'Needs attention';
}

export function gradeOf(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

export function fmtNum(n: number, unit?: string): string {
  let formatted: string;
  if (n >= 100) formatted = Math.round(n).toString();
  else if (n >= 10) formatted = n.toFixed(1);
  else formatted = n.toFixed(2);
  if (formatted.includes('.')) formatted = formatted.replace(/\.?0+$/, '');
  return unit ? `${formatted} ${unit}` : formatted;
}

const LOWER_DIR_NAMES = new Set(
  [
    'sodium',
    'sugar',
    'added sugar',
    'added sugars',
    'saturated fat',
    'trans fat',
    'cholesterol',
    'caffeine',
    'alcohol',
  ].map(s => s.toLowerCase()),
);

const WINDOW_DIR_NAMES = new Set(
  ['calories', 'energy', 'total fat', 'fat'].map(s => s.toLowerCase()),
);

export function inferDirection(name: string, category?: string): Direction {
  const lc = name.toLowerCase();
  if (LOWER_DIR_NAMES.has(lc)) return 'lower';
  if (WINDOW_DIR_NAMES.has(lc)) return 'window';
  if (category && category.toLowerCase() === 'macro') {
    if (lc.includes('fat') && !lc.includes('saturated') && !lc.includes('trans')) {
      return 'window';
    }
    return 'higher';
  }
  return 'higher';
}

/** "Jun 29 – Jul 5" label for the Monday→Sunday week at `weekIdx` (0 = current). */
export function weekRangeLabel(weekIdx: number, refDate: Date = new Date()): string {
  const { startDate, endDate } = getMondayWeekRange(weekIdx, refDate);
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}

export function weekDayLabels(): string[] {
  return [...DAY_CODES_MONDAY_FIRST];
}
