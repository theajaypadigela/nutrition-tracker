/**
 * Pure timezone math. No React Native / Notifee imports — unit-testable in plain Node.
 *
 * The reminder system stores schedule *intent* as a wall-clock {hour, minute} plus a
 * recurrence. Every epoch trigger timestamp is *derived* from that intent against a
 * concrete IANA timezone. Doing the conversion in an explicit timezone (rather than
 * relying on the ambient `Date` behaviour) is what makes occurrence computation
 * deterministic in tests and correct across DST / travel on device.
 */

import { DAY_CODES_SUNDAY_FIRST, DayCode } from '@/utils/dayCode';

export type ZonedParts = {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
};

const PARTS_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = PARTS_FORMATTER_CACHE.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    });
    PARTS_FORMATTER_CACHE.set(timeZone, fmt);
  }
  return fmt;
}

const WEEKDAY_LABEL_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Returns the device's IANA timezone, falling back to 'UTC' if the runtime can't
 * resolve one (older Hermes builds without full Intl). Never throws.
 */
export function resolveDeviceTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.length > 0 ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Decomposes an epoch (ms) into wall-clock parts in the given timezone. */
export function epochToZonedParts(epochMs: number, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(new Date(epochMs));
  const lookup: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      lookup[p.type] = p.value;
    }
  }
  // 'h23' can render midnight as '24' on some ICU builds; normalise to 0.
  let hour = Number(lookup.hour);
  if (hour === 24) {
    hour = 0;
  }
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour,
    minute: Number(lookup.minute),
    second: Number(lookup.second),
    weekday: WEEKDAY_LABEL_TO_INDEX[lookup.weekday] ?? 0,
  };
}

/** Offset of the given instant from UTC, in ms, for the timezone (positive = ahead of UTC). */
export function timeZoneOffsetMs(epochMs: number, timeZone: string): number {
  const p = epochToZonedParts(epochMs, timeZone);
  // The instant, expressed as if its wall-clock fields were UTC.
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // asUtc - epoch ≈ offset (rounded to the second the formatter exposes).
  return asUtc - Math.floor(epochMs / 1000) * 1000;
}

/**
 * Converts a wall-clock {year, month(1-12), day, hour, minute} in `timeZone` to an epoch (ms).
 *
 * Handles DST edges:
 *  - spring-forward (the wall time doesn't exist): resolves to the instant the clock
 *    jumps to, i.e. the offset on the far side of the gap.
 *  - fall-back (the wall time exists twice): resolves to the first (pre-transition) instant.
 */
export function zonedWallTimeToEpoch(
  wall: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
): number {
  const utcGuess = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    0,
  );
  // We want the instant T whose wall-clock in `timeZone` equals `wall`. With offset
  // O(t) = (wall-as-UTC at t) - t, that is T = utcGuess - O(T). Fixed-point iterate:
  const offset0 = timeZoneOffsetMs(utcGuess, timeZone);
  const t1 = utcGuess - offset0;
  const offset1 = timeZoneOffsetMs(t1, timeZone);
  if (offset1 === offset0) {
    // No transition between the guess and the candidate — exact, common case.
    return t1;
  }
  // A DST transition is nearby. Try the offset on the other side.
  const t2 = utcGuess - offset1;
  const offset2 = timeZoneOffsetMs(t2, timeZone);
  if (offset2 === offset1) {
    return t2;
  }
  // Spring-forward gap (the wall time doesn't exist): neither candidate is consistent.
  // Return t1, which rolls the time forward to the post-gap instant (e.g. 02:30 -> 03:30).
  return t1;
}

/** Maps a JS weekday index (0=Sun) to the backend 3-char code. */
export function weekdayIndexToCode(index: number): DayCode {
  return DAY_CODES_SUNDAY_FIRST[((index % 7) + 7) % 7];
}

/** True if `code` is a recognised weekday code (case-insensitive, trimmed). */
export function normalizeWeekdayCode(raw: string): DayCode | null {
  const trimmed = raw.trim().toLowerCase();
  for (const code of DAY_CODES_SUNDAY_FIRST) {
    if (code.toLowerCase() === trimmed) {
      return code;
    }
  }
  return null;
}
