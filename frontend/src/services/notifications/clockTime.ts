/**
 * Pure clock-time parsing and canonical key derivation. No RN/Notifee imports.
 *
 * Habit reminder times arrive from the server as strings ("8:30 AM", "08:30 AM",
 * "20:00"). The previous implementation silently defaulted an unparseable string to
 * 08:00, scheduling a wrong-time ringing call (P0 #7). These helpers fail loudly
 * (return null) so callers can refuse to schedule and surface the failure instead.
 */

export type WallClockTime = {
  /** 0-23 */
  hour: number;
  /** 0-59 */
  minute: number;
};

const TWELVE_HOUR = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/;
const TWENTY_FOUR_HOUR = /^(\d{1,2}):(\d{2})$/;

/**
 * Parses "h:mm AM/PM" or "HH:mm" into {hour, minute}. Returns null on any malformed
 * input or out-of-range value — never guesses a default time.
 */
export function parseClockTime(raw: string | null | undefined): WallClockTime | null {
  if (raw == null) {
    return null;
  }
  const value = raw.trim();
  if (value.length === 0) {
    return null;
  }

  const twelve = value.match(TWELVE_HOUR);
  if (twelve) {
    let hour = parseInt(twelve[1], 10);
    const minute = parseInt(twelve[2], 10);
    const period = twelve[3].toUpperCase();
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
      return null;
    }
    if (period === 'PM' && hour !== 12) {
      hour += 12;
    }
    if (period === 'AM' && hour === 12) {
      hour = 0;
    }
    return { hour, minute };
  }

  const twentyFour = value.match(TWENTY_FOUR_HOUR);
  if (twentyFour) {
    const hour = parseInt(twentyFour[1], 10);
    const minute = parseInt(twentyFour[2], 10);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return null;
    }
    return { hour, minute };
  }

  return null;
}

/**
 * Canonical 24h key for a time, e.g. {hour:8, minute:30} -> "08:30".
 * Used as the stable slot identifier for consolidated call notifications so that
 * "8:30 AM", " 8:30 AM " and "08:30" all collapse to one slot.
 */
export function formatClock24Key(time: WallClockTime): string {
  const hh = String(time.hour).padStart(2, '0');
  const mm = String(time.minute).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Parses a raw time string and returns its canonical 24h key, or null if unparseable.
 * Replaces the whitespace-and-case-naive string munging that produced inconsistent
 * slot keys.
 */
export function canonicalSlotKey(raw: string | null | undefined): string | null {
  const parsed = parseClockTime(raw);
  return parsed ? formatClock24Key(parsed) : null;
}
