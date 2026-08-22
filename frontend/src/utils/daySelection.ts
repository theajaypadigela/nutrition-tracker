import { DAY_CODES_MONDAY_FIRST, DayCode } from './dayCode';

export const WEEKDAYS: DayCode[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const WEEKENDS: DayCode[] = ['Sat', 'Sun'];

const hasAll = (days: DayCode[], subset: DayCode[]) =>
  subset.every(d => days.includes(d));
const hasNone = (days: DayCode[], subset: DayCode[]) =>
  !subset.some(d => days.includes(d));

/** Add the day if absent, remove it if present. */
export const toggleDay = (days: DayCode[], day: DayCode): DayCode[] =>
  days.includes(day) ? days.filter(d => d !== day) : [...days, day];

export const isAllDays = (days: DayCode[]): boolean => days.length === 7;
export const isWeekdaysOnly = (days: DayCode[]): boolean =>
  hasAll(days, WEEKDAYS) && hasNone(days, WEEKENDS);
export const isWeekendsOnly = (days: DayCode[]): boolean =>
  hasAll(days, WEEKENDS) && hasNone(days, WEEKDAYS);

// Quick-pick toggles: selecting an already-exact set clears it (matches prior screen UX).
export const toggleAllDays = (days: DayCode[]): DayCode[] =>
  isAllDays(days) ? [] : [...DAY_CODES_MONDAY_FIRST];
export const toggleWeekdays = (days: DayCode[]): DayCode[] =>
  isWeekdaysOnly(days) ? [] : [...WEEKDAYS];
export const toggleWeekends = (days: DayCode[]): DayCode[] =>
  isWeekendsOnly(days) ? [] : [...WEEKENDS];

/** Human-readable summary of the selected repeat days. */
export const getRepeatSummary = (days: DayCode[]): string => {
  if (days.length === 0) return 'No days selected';
  if (isAllDays(days)) return 'Every day';
  if (isWeekdaysOnly(days)) return 'Weekdays';
  if (isWeekendsOnly(days)) return 'Weekends';
  return days.join(', ');
};
