/**
 * Central notification-id conventions. Pure (no RN/Notifee imports).
 *
 * Reconciliation can only safely prune triggers this app owns, so every id the app
 * creates flows through here and `isAppOwnedTriggerId` recognises them (including the
 * legacy schemes so a first reconciliation pass migrates them cleanly).
 */

import { DayCode } from '@/utils/dayCode';

export const MEAL_DAILY_ID = 'meal-alarm-daily';
export const MEAL_RESCHEDULE_ID = 'meal-reschedule-once';

/** Consolidated call notification for a habit time slot, daily variant. */
export function habitCallDailyId(slotKey: string): string {
  return `habit-call-${slotKey}`;
}

/** Consolidated call notification for a habit time slot on a specific weekday. */
export function habitCallWeeklyId(slotKey: string, weekday: DayCode): string {
  return `habit-call-${slotKey}-${weekday}`;
}

/** Per-habit push notification, daily variant. */
export function habitPushDailyId(habitId: string): string {
  return `habit-push-${habitId}`;
}

/** Per-habit push notification on a specific weekday. */
export function habitPushWeeklyId(habitId: string, weekday: DayCode): string {
  return `habit-push-${habitId}-${weekday}`;
}

/** One-shot reschedule trigger for a habit slot ("call me back in 20m"). */
export function habitRescheduleCallId(slotKey: string): string {
  return `habit-reschedule-call-${slotKey}`;
}

export function habitReschedulePushId(habitId: string): string {
  return `habit-reschedule-${habitId}`;
}

const APP_OWNED_PREFIXES = [
  // `meal-` (not just `meal-alarm`/`meal-reschedule`) so reconciliation also prunes any meal
  // trigger left over from an earlier id scheme (e.g. a dev rebuild that armed a different meal
  // id). Without this, a stale meal trigger at an old time is neither overwritten (different id)
  // nor pruned (not recognised as ours) and keeps firing at the old time after a reschedule.
  'meal-',
  'habit-call-',
  'habit-push-',
  'habit-reschedule-',
  // Legacy scheme: per-habit ids were `habit-<id>` before the push-/call- split.
  'habit-',
];

/**
 * True if the id was created by this app's reminder system and is therefore eligible
 * for pruning during reconciliation. Anything else (e.g. a notification from another
 * library or a future feature) is left untouched.
 */
export function isAppOwnedTriggerId(id: string): boolean {
  return APP_OWNED_PREFIXES.some(prefix => id.startsWith(prefix));
}
