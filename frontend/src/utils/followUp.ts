/**
 * One source of truth for follow-up ("call me back in N minutes") messaging, shared by the
 * meal and habit voice screens so the two stop drifting apart.
 *
 * Two things this fixes:
 *  - The meal copy used to promise "(today only)", but the reschedule engine arms an
 *    absolute epoch and explicitly allows cross-midnight, so that promise was false. We now
 *    state the actual armed time instead.
 *  - The time shown is derived from the fire epoch the scheduler ACTUALLY armed (returned by
 *    rescheduleMeal/rescheduleHabit), not a second Date.now() recomputed in the screen, so
 *    the displayed time can't skew from the real one.
 */

import { formatEpochTime12h } from './timeFormatter';

export function pluralizeMinutes(minutes: number): string {
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/**
 * Builds the unified follow-up confirmation, e.g.:
 *   "Meals logged. Next call in 20 minutes at 8:45 PM."
 *   "\"Drink water\" rescheduled. Next call in 1 minute at 8:45 PM."
 * `lead` is the subject-specific sentence the caller supplies; the "Next call in …" tail is
 * identical across lanes.
 */
export function buildFollowUpMessage(opts: {
  lead?: string;
  minutes: number;
  fireAt: number | null;
}): string {
  const { lead, minutes, fireAt } = opts;
  const at = fireAt != null ? ` at ${formatEpochTime12h(fireAt)}` : '';
  const tail = `Next call in ${pluralizeMinutes(minutes)}${at}.`;
  return lead ? `${lead} ${tail}` : tail;
}

/**
 * Shown when a reschedule could not be armed. This only happens for invalid (≤0 / non-finite)
 * delays — NOT a day boundary (the engine allows cross-midnight), which is why the old
 * "would fall on the next day" copy was dead and misleading.
 */
export const FOLLOW_UP_INVALID_MESSAGE =
  'Could not schedule a valid follow-up time.';
