/**
 * The reconciliation pass (§B) — the single recovery path for most of the survival
 * matrix. Runs at every cold start, every foreground resume, after boot, on login, and
 * after any schedule save. It:
 *   1. recomputes desired triggers from schedule intent (meal cache/server + habit
 *      cache/server + persisted reschedules) against the device timezone and wall-clock,
 *   2. diffs them against notifee.getTriggerNotificationIds(),
 *   3. re-arms what's missing (and refreshes existing fire times — DST drift correction),
 *   4. prunes orphans we own,
 *   5. resolves elapsed reschedules as missed and shows missed follow-ups.
 *
 * Defensiveness: a transient habit-fetch failure must never cause us to prune live habit
 * triggers, so when the habit set is served from cache (fetch failed) we still arm those
 * habits but exclude habit-* ids from pruning entirely.
 */

import notifee from '@notifee/react-native';
import { reminderLog } from './logger';
import { resolveDeviceTimeZone } from './time';
import { ensureChannels } from './channels';
import {
  readPermissionSnapshot,
  canScheduleExact,
  PermissionSnapshot,
} from './permissions';
import { isAppOwnedTriggerId } from './ids';
import { diffTriggers } from './reconcileDiff';
import {
  computeDesiredTriggers,
  armSpec,
  cancelTrigger,
  ArmSpec,
} from './scheduler';
import { loadMealScheduleCached, MealSchedule } from './mealScheduleStore';
import { fetchHabitsFromServer, loadHabitsCached } from './habitStore';
import {
  listReschedules,
  removeReschedule,
  RescheduleEntry,
} from './rescheduleStore';
import { recordMissed, missedKey, listMissedNeedingFollowUp, markFollowUpShown } from './missedStore';
import { buildMissedFollowUp } from './notificationBuilder';
import { reconcileExpiredAnswers } from './callLifecycle';
import { applyCallResultMarkers } from './callMarkers';

export type ReconcileReason =
  | 'cold-start'
  | 'resume'
  | 'boot'
  | 'login'
  | 'logout'
  | 'save';

export type ReconcileReport = {
  reason: ReconcileReason;
  armed: string[];
  pruned: string[];
  missed: number;
  exact: boolean;
  skippedHabits: boolean;
};

// Serialize reconciliation passes. Coalescing into a single in-flight promise is wrong
// because different callers pass different args (e.g. a logout pass with isAuthenticated
// false must not receive an in-flight authenticated pass's result and skip clearing).
// Chaining runs each pass after the previous settles — no overlap, no dropped calls.
let chain: Promise<unknown> = Promise.resolve();

/**
 * Runs a reconciliation pass. Concurrent calls coalesce into the in-flight one so a
 * resume firing while a cold-start pass is still running doesn't double-arm.
 */
export async function runReconciliation(options: {
  reason: ReconcileReason;
  isAuthenticated: boolean;
  nowEpoch?: number;
  /**
   * Prune habit-* orphans even when the live habit fetch fails. Set by an explicit
   * user-initiated habit change (create/edit/delete), where the local habit cache was just
   * authoritatively updated — so the old time-slot trigger must be cancelled now rather than
   * lingering until the next successful fetch (otherwise a habit time change can ring at both
   * the old and new times). Background passes leave this false so a transient outage never
   * looks like a server-side delete.
   */
  forceHabitPrune?: boolean;
}): Promise<ReconcileReport> {
  const next = chain.then(
    () => doReconcile(options),
    () => doReconcile(options),
  );
  // Keep the chain alive even if a pass rejects, without leaking the rejection here.
  chain = next.catch(() => undefined);
  return next;
}

async function doReconcile(options: {
  reason: ReconcileReason;
  isAuthenticated: boolean;
  nowEpoch?: number;
  forceHabitPrune?: boolean;
}): Promise<ReconcileReport> {
  const nowEpoch = options.nowEpoch ?? Date.now();
  const timeZone = resolveDeviceTimeZone();

  await ensureChannels();

  const pendingIds = await notifee.getTriggerNotificationIds().catch(() => [] as string[]);

  // Logout / unauthenticated: cancel everything we own and stop. Login rebuilds.
  if (!options.isAuthenticated) {
    const owned = pendingIds.filter(isAppOwnedTriggerId);
    for (const id of owned) {
      await cancelTrigger(id);
    }
    reminderLog.info('reconcile.logout_clear', 'Cleared reminders for unauthenticated state', {
      cleared: owned.length,
    });
    return {
      reason: options.reason,
      armed: [],
      pruned: owned,
      missed: 0,
      exact: false,
      skippedHabits: true,
    };
  }

  const snapshot: PermissionSnapshot = await readPermissionSnapshot();
  const exact = canScheduleExact(snapshot);

  const meal: MealSchedule = await loadMealScheduleCached();
  // Habit intent is cache-first, matching the meal path: a successful fetch is authoritative
  // and refreshes the cache; a failed fetch (server unreachable / not yet deployed / timeout /
  // cold-start token race) falls back to the last-known cached habits so triggers still arm
  // instead of silently arming nothing. Only an authoritative fetch may prune habit-* triggers
  // (a transient outage must never look like a server-side delete).
  const fetchedHabits = await fetchHabitsFromServer();
  const habitsAuthoritative = fetchedHabits != null;
  const habits = fetchedHabits ?? (await loadHabitsCached());
  const skippedHabits = !habitsAuthoritative;
  if (!habitsAuthoritative) {
    reminderLog.warn(
      'reconcile.habits_from_cache',
      'Habit fetch unavailable; arming from cached habit set',
      { cached: habits.length },
    );
  }
  const reschedules: RescheduleEntry[] = await listReschedules();

  // Apply terminal call markers the native surface recorded while the app was away (DECLINED, and
  // MISSED for calls that rang out), BEFORE the pending-answer missed sweep below so a decline /
  // native-miss is never misclassified or double-counted. No-ops on iOS / when the module is absent.
  await applyCallResultMarkers().catch(() => {});

  // Resolve elapsed reschedules: a one-shot still in the store with fireAt in the past
  // never fired (app was killed past its time) -> record missed and drop it.
  // Unanswered calls that timed out while the app was killed become misses.
  let missedCount = await reconcileExpiredAnswers(nowEpoch);

  const futureReschedules: RescheduleEntry[] = [];
  for (const r of reschedules) {
    if (r.fireAt <= nowEpoch) {
      const slotOrHabit = r.habit?.habitId ?? r.slotKey ?? 'reschedule';
      const newly = await recordMissed({
        key: missedKey(r.kind, r.fireAt, slotOrHabit),
        kind: r.kind,
        intendedFireAt: r.fireAt,
        recordedAt: nowEpoch,
        slotKey: r.slotKey,
        habit: r.habit,
      });
      if (newly) missedCount++;
      await removeReschedule(r.id);
    } else {
      futureReschedules.push(r);
    }
  }

  const plan = computeDesiredTriggers({
    meal,
    habits,
    reschedules: futureReschedules,
    nowEpoch,
    timeZone,
  });

  // When the habit set is not authoritative (fetch failed; armed from cache), never prune
  // habit-* triggers (avoid nuking live ones on a transient outage). Otherwise prune any
  // app-owned orphan. An explicit habit change (forceHabitPrune) overrides the guard: the
  // cache was just updated by the user's create/edit/delete, so the stale old-time-slot
  // trigger must be cancelled now instead of ringing alongside the new one.
  const suppressHabitPrune = skippedHabits && !options.forceHabitPrune;
  const ownedIdPredicate = suppressHabitPrune
    ? (id: string) => isAppOwnedTriggerId(id) && !id.startsWith('habit-')
    : isAppOwnedTriggerId;

  const diff = diffTriggers(plan.desired, pendingIds, { ownedIdPredicate });

  const armed: string[] = [];
  for (const d of diff.toArm) {
    const spec = plan.specs.get(d.id) as ArmSpec | undefined;
    if (!spec) continue;
    try {
      await armSpec(spec, exact);
      armed.push(spec.id);
    } catch (e) {
      reminderLog.error('reconcile.arm_failed', `Failed to arm ${spec.id}`, {
        error: String(e),
      });
    }
  }

  const pruned: string[] = [];
  for (const id of diff.toPrune) {
    await cancelTrigger(id);
    pruned.push(id);
  }

  // Surface missed follow-ups that haven't been shown yet.
  await showMissedFollowUps();

  reminderLog.info('reconcile.done', `Reconciliation (${options.reason}) complete`, {
    armed: armed.length,
    pruned: pruned.length,
    missed: missedCount,
    exact,
    skippedHabits,
    pending: pendingIds.length,
  });

  return {
    reason: options.reason,
    armed,
    pruned,
    missed: missedCount,
    exact,
    skippedHabits,
  };
}

/** Shows the quiet "you missed your reminder" follow-up for each unshown missed record. */
export async function showMissedFollowUps(): Promise<void> {
  const pending = await listMissedNeedingFollowUp();
  for (const record of pending) {
    try {
      const followUp = buildMissedFollowUp({
        id: `missed-${record.key}`,
        kind: record.kind,
        habit: record.habit,
        slotKey: record.slotKey,
      });
      await notifee.displayNotification(followUp);
      await markFollowUpShown(record.key);
    } catch (e) {
      reminderLog.warn('missed.followup_failed', 'Failed to show missed follow-up', {
        key: record.key,
        error: String(e),
      });
    }
  }
}
