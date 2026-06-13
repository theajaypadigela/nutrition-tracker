/**
 * Backward-compatible habit-scheduler surface. The real logic lives in
 * src/services/notifications/* . Habit reminders are now recurrence-aware (repeatDays),
 * recover via reconciliation, and never silently schedule an 8am default on a parse miss.
 *
 * Scheduling/cancelling is expressed as "reconcile from server truth" rather than manual
 * per-trigger bookkeeping — this is what eliminates the same-slot delete race (§E): after
 * a server delete, reconciliation recomputes the desired set and prunes orphaned slot
 * triggers, with no stale-closure list to get wrong.
 */

import { Habit } from '../types/types';
import {
  reconcileAfterHabitChange,
  rescheduleHabit,
} from './notifications/reminderService';
import { ensureChannels } from './notifications/channels';
import { upsertHabitCached, removeHabitCached } from './notifications/habitStore';

/** Retained for callers; channels are also ensured on startup and each reconcile. */
export async function ensureHabitChannels(): Promise<void> {
  await ensureChannels();
}

/**
 * Arms reminders for the current habit set (idempotent; safe to call after create/edit).
 *
 * The created/edited habit is written to the offline cache FIRST so reconciliation can arm
 * it even if the `GET /habit` round-trip is unavailable — restoring the resilience the old
 * direct-scheduling path had, while keeping the reconcile-from-truth architecture.
 */
export async function scheduleHabitReminder(habit: Habit): Promise<void> {
  await upsertHabitCached(habit);
  await reconcileAfterHabitChange();
}

export async function scheduleHabitReschedule(
  habit: Habit,
  rescheduleMinutes: number,
): Promise<boolean> {
  const fireAt = await rescheduleHabit(habit, rescheduleMinutes);
  return fireAt != null;
}

/** Re-arms from server truth, pruning any triggers for a now-deleted habit. */
export async function cancelHabitReminder(habitId: string): Promise<void> {
  // Drop it from the cache too, so a reconcile whose fetch fails doesn't re-arm a habit the
  // user just deleted.
  await removeHabitCached(habitId);
  await reconcileAfterHabitChange();
}

/** Re-arms from server truth, pruning the slot trigger if no habit still uses it. */
export async function cancelHabitCallSlot(_reminderTime: string): Promise<void> {
  await reconcileAfterHabitChange();
}
