/**
 * Backward-compatible meal-scheduler surface. The real logic lives in
 * src/services/notifications/* (intent store + reconciliation + occurrence math). This
 * file keeps the function names the screens already import while delegating to the new
 * reliability core, so meal reminders now: derive epochs from wall-clock intent, recur
 * via reconciliation, persist server-side, and reschedule across midnight.
 */

import {
  MealSchedule,
  loadMealScheduleCached,
  saveMealScheduleCached,
  pushMealScheduleToServer,
  defaultMealSchedule,
} from './notifications/mealScheduleStore';
import {
  reconcileReminders,
  rescheduleMeal,
  getMealRescheduleFireAt,
  clearMealReschedule,
} from './notifications/reminderService';

export type MealReminder = MealSchedule;
// Kept as an alias for backward compat with screens.
export type MealSlot = MealReminder;

export function defaultSchedule(): MealReminder {
  return defaultMealSchedule();
}

export async function loadSchedule(): Promise<MealReminder> {
  return loadMealScheduleCached();
}

export async function saveSchedule(reminder: MealReminder): Promise<void> {
  await saveMealScheduleCached(reminder);
  // Persist server-side so the schedule survives reinstall / data-clear and converges
  // across devices. Best-effort: the cache is authoritative offline.
  await pushMealScheduleToServer(reminder);
}

/**
 * Re-arms the meal reminder by running a reconciliation pass (which reads the freshly
 * saved schedule). Replaces the old cancel-then-create-DAILY-trigger logic.
 */
export async function scheduleAllAlarms(_reminder: MealReminder): Promise<void> {
  await reconcileReminders('save', true);
}

export async function scheduleMealReschedule(delayMinutes: number): Promise<boolean> {
  const fireAt = await rescheduleMeal(delayMinutes);
  return fireAt != null;
}

export async function cancelAllMealAlarms(): Promise<void> {
  // Disabling the schedule and reconciling prunes the meal triggers; callers that want
  // a hard cancel of the reschedule use clearMealRescheduleTime.
  await clearMealReschedule();
}

export async function loadMealRescheduleTime(): Promise<number | null> {
  return getMealRescheduleFireAt();
}

export async function clearMealRescheduleTime(): Promise<void> {
  await clearMealReschedule();
}
