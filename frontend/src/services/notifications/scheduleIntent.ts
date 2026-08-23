/**
 * Schedule intent: the single source of truth for *when* a reminder should fire.
 * Pure types + occurrence math. No RN/Notifee imports.
 *
 * Epoch trigger timestamps are always derived from intent against a timezone, never
 * stored as authoritative. This is what lets reconciliation recompute correct fire
 * times after reboot, DST, or travel.
 */

import { DAY_CODES_SUNDAY_FIRST, DayCode } from '@/utils/dayCode';
import { WallClockTime } from './clockTime';
import {
  epochToZonedParts,
  zonedWallTimeToEpoch,
  weekdayIndexToCode,
} from './time';

export type Recurrence =
  | { kind: 'daily' }
  | { kind: 'weekly'; days: DayCode[] };

export type ScheduleIntent = {
  time: WallClockTime;
  recurrence: Recurrence;
};

export const dailyRecurrence = (): Recurrence => ({ kind: 'daily' });

/** Builds a weekly recurrence from backend repeatDays, dropping unrecognised codes. */
export function weeklyRecurrence(days: DayCode[]): Recurrence {
  const valid = days.filter(d => DAY_CODES_SUNDAY_FIRST.includes(d));
  return { kind: 'weekly', days: valid };
}

function recurrenceFiresOnWeekday(recurrence: Recurrence, weekdayIndex: number): boolean {
  if (recurrence.kind === 'daily') {
    return true;
  }
  return recurrence.days.includes(weekdayIndexToCode(weekdayIndex));
}

/**
 * The soonest epoch (ms), strictly after `fromEpoch`, at which the intent fires in
 * `timeZone`. Returns null only for a weekly recurrence with no selected days.
 *
 * Boundary rule (deterministic, tested): the fire instant is the top of the target
 * minute (seconds/millis = 0). If that instant is <= fromEpoch it is skipped and the
 * next eligible day is used. So saving exactly at the reminder minute schedules the
 * *next* occurrence, never an immediate re-ring.
 */
export function nextOccurrence(
  intent: ScheduleIntent,
  fromEpoch: number,
  timeZone: string,
): number | null {
  if (intent.recurrence.kind === 'weekly' && intent.recurrence.days.length === 0) {
    return null;
  }

  const base = epochToZonedParts(fromEpoch, timeZone);

  // Scan today + the next 8 days. 8 guarantees we cross a full week even when the
  // recurrence selects a single weekday, and tolerates DST day-length changes.
  for (let offset = 0; offset <= 8; offset++) {
    const candidate = addDaysToWallDate(base, offset);
    if (!recurrenceFiresOnWeekday(intent.recurrence, candidate.weekdayIndex)) {
      continue;
    }
    const epoch = zonedWallTimeToEpoch(
      {
        year: candidate.year,
        month: candidate.month,
        day: candidate.day,
        hour: intent.time.hour,
        minute: intent.time.minute,
      },
      timeZone,
    );
    if (epoch > fromEpoch) {
      return epoch;
    }
  }
  return null;
}

/**
 * A rolling window of the next `count` occurrences strictly after `fromEpoch`.
 * Used to pre-arm N future fires (e.g. weekly habits) within platform pending-trigger
 * caps; reconciliation tops the window back up.
 */
export function nextOccurrences(
  intent: ScheduleIntent,
  fromEpoch: number,
  count: number,
  timeZone: string,
): number[] {
  const out: number[] = [];
  let cursor = fromEpoch;
  for (let i = 0; i < count; i++) {
    const next = nextOccurrence(intent, cursor, timeZone);
    if (next == null) {
      break;
    }
    out.push(next);
    cursor = next;
  }
  return out;
}

/**
 * Advances a wall date by `days` calendar days using UTC date arithmetic on the
 * date fields only (immune to DST because we never touch the time-of-day here), and
 * recomputes the weekday. Returns wall-date fields, not an instant.
 */
function addDaysToWallDate(
  base: { year: number; month: number; day: number },
  days: number,
): { year: number; month: number; day: number; weekdayIndex: number } {
  const anchor = Date.UTC(base.year, base.month - 1, base.day);
  const shifted = new Date(anchor + days * 86_400_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekdayIndex: shifted.getUTCDay(),
  };
}
