/**
 * The one weekday-string type in the app, and the two orderings of it.
 *
 * There used to be two identical unions — `utils/daySelection.DayKey` (Mon-first) and
 * `services/notifications/time.WeekdayCode` (Sun-first) — which meant every value
 * crossing between the habit-selection UI and the scheduler needed a conversion that
 * was really a no-op. Same seven strings, so one type.
 *
 * The two *orderings* are genuinely different and both are kept, named so the
 * difference is impossible to miss:
 *  - DAY_CODES_SUNDAY_FIRST is index-addressed. Position N is the day JS
 *    `Date#getDay()` reports as N, so it is the only correct array to index into
 *    with a weekday number.
 *  - DAY_CODES_MONDAY_FIRST is display order — the order habit repeat-days and the
 *    weekly nutrition summary render in. Never index into it with a date's weekday.
 */

export type DayCode = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

/**
 * JS `Date#getDay()` order: index 0 = Sunday. Also the shape the backend's
 * `repeatDays` uses (3-char title-case codes — see HabitService.getHabitsByDate).
 */
export const DAY_CODES_SUNDAY_FIRST: DayCode[] = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
];

/** Display order: the week as the UI shows it, starting Monday. */
export const DAY_CODES_MONDAY_FIRST: DayCode[] = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
];
