/**
 * Centralized time formatting. These previously lived as five near-but-not-identical
 * local helpers across screens. The differences are intentional and preserved here:
 *  - 12h non-padded ("9:05 PM")  — reschedule / log display
 *  - 12h zero-padded ("09:05 PM") — the reminderTime string persisted to the backend
 *  - locale clock                 — time-picker previews (device-locale dependent)
 */

const to12h = (hour24: number): number => hour24 % 12 || 12;
const pad2 = (n: number): string => String(n).padStart(2, '0');
const meridiem = (hour24: number): 'AM' | 'PM' => (hour24 >= 12 ? 'PM' : 'AM');

/** "9:05 PM" — non-padded hour. */
export function formatTime12h(date: Date): string {
  const h24 = date.getHours();
  return `${to12h(h24)}:${pad2(date.getMinutes())} ${meridiem(h24)}`;
}

/** "9:05 PM" from an ISO string; returns '' when the string is unparseable. */
export function formatIsoTime12h(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  return formatTime12h(date);
}

/** "9:05 PM" from an epoch-millisecond timestamp. */
export function formatEpochTime12h(ts: number): string {
  return formatTime12h(new Date(ts));
}

/**
 * "09:05 PM" — zero-padded hour. This is the exact reminderTime format persisted to the
 * backend on habit creation; keep it byte-identical.
 */
export function formatReminderTime(date: Date): string {
  const h24 = date.getHours();
  return `${pad2(to12h(h24))}:${pad2(date.getMinutes())} ${meridiem(h24)}`;
}

/** Device-locale clock time, e.g. "09:05 PM" or "21:05". For time-picker previews. */
export function formatClockTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Locale clock time built from an (hour, minute) pair. */
export function formatClockTimeFromParts(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute);
  return formatClockTime(d);
}

/**
 * Locale clock time from an (hour, minute) pair with a NON-padded hour, e.g. "8:00 PM"
 * (vs formatClockTimeFromParts' "08:00 PM"). Auth/onboarding call-time display; moved
 * here from authTheme.formatTime — keep the `hour: 'numeric'` behavior.
 */
export function formatLocaleTimeFromParts(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
