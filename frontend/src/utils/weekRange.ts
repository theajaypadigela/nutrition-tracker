import { formatLocalDate } from './date';

export const DAYS_IN_WEEK = 7;

export interface WeekRange {
  startDate: string;
  endDate: string;
  /** Days of the current week elapsed so far (1 = first day ... 7 = last day). */
  daysElapsed: number;
}

/**
 * Current Sunday→Saturday week range as local YYYY-MM-DD strings, plus how many days of the
 * week have elapsed (Sun = 1 ... Sat = 7). `now` is injectable for tests.
 */
export function getCurrentSundayToSaturdayRange(now: Date = new Date()): WeekRange {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(now.getDate() - now.getDay());

  const end = new Date(start);
  end.setDate(start.getDate() + DAYS_IN_WEEK - 1);

  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
    daysElapsed: now.getDay() + 1,
  };
}

/**
 * Monday→Sunday week range offset by `weekIdx` (0 = current week, -1 = last week, ...),
 * as local YYYY-MM-DD strings. `now` is injectable for tests.
 */
export function getMondayWeekRange(
  weekIdx: number,
  now: Date = new Date(),
): { startDate: string; endDate: string } {
  const day = now.getDay();
  const offsetToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + offsetToMon + weekIdx * DAYS_IN_WEEK);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + DAYS_IN_WEEK - 1);
  return {
    startDate: formatLocalDate(monday),
    endDate: formatLocalDate(sunday),
  };
}
