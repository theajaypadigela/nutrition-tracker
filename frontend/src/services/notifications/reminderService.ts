/**
 * Public facade for the reminder system. App lifecycle, screens, and the health surface
 * import from here; the internal modules stay private to this folder.
 */

import { Habit } from '../../types/types';
import { runReconciliation, ReconcileReason, ReconcileReport } from './reconciliation';
import { ensureChannels } from './channels';
import { registerIosCategories } from './iosCategories';
import {
  syncMealScheduleFromServer,
  saveMealScheduleCached,
  pushMealScheduleToServer,
  MealSchedule,
} from './mealScheduleStore';
import {
  upsertReschedule,
  removeReschedule,
  listReschedules,
  clearAllReschedules,
  RescheduleEntry,
} from './rescheduleStore';
import { clearPendingAnswers } from './pendingAnswerStore';
import { clearMissed } from './missedStore';
import { clearHabitsCached } from './habitStore';
import {
  readPermissionSnapshot,
  canScheduleExact,
  requestCorePermissions,
  PermissionSnapshot,
} from './permissions';
import { armSpec, cancelTrigger } from './scheduler';
import { MEAL_RESCHEDULE_ID, habitRescheduleCallId, habitReschedulePushId } from './ids';
import { canonicalSlotKey } from './clockTime';
import { reminderLog } from './logger';

/** One-time startup: create channels and register iOS action categories. */
export async function initReminders(): Promise<void> {
  await ensureChannels();
  await registerIosCategories();
}

export async function reconcileReminders(
  reason: ReconcileReason,
  isAuthenticated: boolean,
): Promise<ReconcileReport> {
  return runReconciliation({ reason, isAuthenticated });
}

/** Login (incl. a second device): converge meal schedule from server, then rebuild triggers. */
export async function onLoginReminders(): Promise<ReconcileReport> {
  await syncMealScheduleFromServer();
  return runReconciliation({ reason: 'login', isAuthenticated: true });
}

/** Logout: cancel every local trigger and clear device-local reminder state. */
export async function onLogoutReminders(): Promise<void> {
  await runReconciliation({ reason: 'logout', isAuthenticated: false });
  await clearAllReschedules();
  await clearPendingAnswers();
  await clearMissed();
  // Drop the cached habit set so the next account's reconciliation can't arm the previous
  // user's habits from a stale cache if its first habit fetch fails.
  await clearHabitsCached();
}

export async function requestReminderPermissions(): Promise<PermissionSnapshot> {
  return requestCorePermissions();
}

export async function readReminderPermissions(): Promise<PermissionSnapshot> {
  return readPermissionSnapshot();
}

/** Persist a meal schedule (cache + server) and re-arm. */
export async function saveMealSchedule(schedule: MealSchedule): Promise<ReconcileReport> {
  await saveMealScheduleCached(schedule);
  await pushMealScheduleToServer(schedule);
  return runReconciliation({ reason: 'save', isAuthenticated: true });
}

/** Re-arm after a habit was created or deleted (server is the source of truth). */
export async function reconcileAfterHabitChange(): Promise<ReconcileReport> {
  return runReconciliation({ reason: 'save', isAuthenticated: true });
}

async function armReschedule(entry: RescheduleEntry): Promise<void> {
  const snapshot = await readPermissionSnapshot();
  const exact = canScheduleExact(snapshot);
  await upsertReschedule(entry);
  await armSpec(
    {
      id: entry.id,
      kind: entry.kind,
      fireAt: entry.fireAt,
      repeat: 'none',
      isCall: entry.kind !== 'habit-push',
      slotKey: entry.slotKey,
      habit: entry.habit,
      isReschedule: true,
    },
    exact,
  );
  reminderLog.info('reschedule.armed', 'Armed a reschedule', {
    id: entry.id,
    fireAt: entry.fireAt,
  });
}

/**
 * "Call me back in N minutes" for the meal call. Cross-midnight allowed (the fire epoch
 * is absolute), and the entry is persisted so it replays if the app restarts before it fires.
 * Returns the fire epoch (ms), or null on invalid input.
 */
export async function rescheduleMeal(
  delayMinutes: number,
  nowEpoch: number = Date.now(),
): Promise<number | null> {
  const normalized = Math.floor(delayMinutes);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }
  const fireAt = nowEpoch + normalized * 60_000;
  await armReschedule({ id: MEAL_RESCHEDULE_ID, kind: 'meal-call', fireAt });
  return fireAt;
}

export async function rescheduleHabit(
  habit: Habit,
  delayMinutes: number,
  nowEpoch: number = Date.now(),
): Promise<number | null> {
  const normalized = Math.floor(delayMinutes);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }
  const isCall = habit.reminderType === 'call';
  const slotKey = canonicalSlotKey(habit.reminderTime) ?? undefined;
  const id = isCall
    ? habitRescheduleCallId(slotKey ?? 'slot')
    : habitReschedulePushId(habit.id);
  const fireAt = nowEpoch + normalized * 60_000;
  await armReschedule({
    id,
    kind: isCall ? 'habit-call' : 'habit-push',
    fireAt,
    slotKey,
    habit: { habitId: habit.id, habitName: habit.name, habitTime: habit.reminderTime },
  });
  return fireAt;
}

/** The meal reschedule's future fire time for the FoodLog banner, or null. */
export async function getMealRescheduleFireAt(
  nowEpoch: number = Date.now(),
): Promise<number | null> {
  const all = await listReschedules();
  const meal = all.find(e => e.id === MEAL_RESCHEDULE_ID && e.fireAt > nowEpoch);
  return meal ? meal.fireAt : null;
}

export async function clearMealReschedule(): Promise<void> {
  await removeReschedule(MEAL_RESCHEDULE_ID);
  await cancelTrigger(MEAL_RESCHEDULE_ID);
}
