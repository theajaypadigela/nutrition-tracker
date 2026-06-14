export type DayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export const ALL_DAYS: DayKey[] = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
];
export const WEEKDAYS: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const WEEKENDS: DayKey[] = ['Sat', 'Sun'];

const hasAll = (days: DayKey[], subset: DayKey[]) =>
  subset.every(d => days.includes(d));
const hasNone = (days: DayKey[], subset: DayKey[]) =>
  !subset.some(d => days.includes(d));

/** Add the day if absent, remove it if present. */
export const toggleDay = (days: DayKey[], day: DayKey): DayKey[] =>
  days.includes(day) ? days.filter(d => d !== day) : [...days, day];

export const isAllDays = (days: DayKey[]): boolean => days.length === 7;
export const isWeekdaysOnly = (days: DayKey[]): boolean =>
  hasAll(days, WEEKDAYS) && hasNone(days, WEEKENDS);
export const isWeekendsOnly = (days: DayKey[]): boolean =>
  hasAll(days, WEEKENDS) && hasNone(days, WEEKDAYS);

// Quick-pick toggles: selecting an already-exact set clears it (matches prior screen UX).
export const toggleAllDays = (days: DayKey[]): DayKey[] =>
  isAllDays(days) ? [] : [...ALL_DAYS];
export const toggleWeekdays = (days: DayKey[]): DayKey[] =>
  isWeekdaysOnly(days) ? [] : [...WEEKDAYS];
export const toggleWeekends = (days: DayKey[]): DayKey[] =>
  isWeekendsOnly(days) ? [] : [...WEEKENDS];

/** Human-readable summary of the selected repeat days. */
export const getRepeatSummary = (days: DayKey[]): string => {
  if (days.length === 0) return 'No days selected';
  if (isAllDays(days)) return 'Every day';
  if (isWeekdaysOnly(days)) return 'Weekdays';
  if (isWeekendsOnly(days)) return 'Weekends';
  return days.join(', ');
};
