/**
 * Per-occurrence call state machine (§E): ringing -> accepted / declined / missed.
 *
 * - On DELIVERED we classify staleness. A stale fire (e.g. a reboot replayed yesterday's
 *   8pm alarm at 3am) is suppressed: no ringing call, a quiet missed record + follow-up
 *   instead, and the next occurrence is armed by reconciliation.
 * - A fresh fire records a pending-answer marker (persisted) so an unanswered call is
 *   detected as missed at the next launch even if the process was killed.
 * - Accept/Decline resolve the marker; Decline (and launch-detected misses) report a
 *   terminal status to the server so habits don't stay PENDING forever.
 */

import {
  classifyFire,
  DEFAULT_STALENESS_THRESHOLD_MS,
} from './staleness';
import { ReminderKind } from './notificationBuilder';
import { reminderLog } from './logger';
import {
  upsertPendingAnswer,
  resolvePendingAnswer,
  listExpiredPendingAnswers,
} from './pendingAnswerStore';
import { recordMissed, missedKey } from './missedStore';
import { removeReschedule } from './rescheduleStore';
import { reportHabitOccurrence } from './habitOccurrenceApi';

export const RING_TIMEOUT_MS = 60_000;

export type OccurrenceData = {
  kind: ReminderKind;
  intendedFireAt: number | null;
  slotKey?: string;
  habitId?: string;
  habitName?: string;
  habitTime?: string;
  isRescheduled: boolean;
};

/** Extracts the occurrence descriptor from a notification's data bag (tolerant of legacy payloads). */
export function readOccurrenceData(
  data: Record<string, any> | undefined,
): OccurrenceData {
  const screen = data?.screen as string | undefined;
  let kind: ReminderKind;
  if (data?.reminderKind === 'meal-call' || data?.reminderKind === 'habit-call' || data?.reminderKind === 'habit-push') {
    kind = data.reminderKind;
  } else if (screen === 'IncomingMealCall') {
    kind = 'meal-call';
  } else if (screen === 'IncomingHabitCall') {
    kind = 'habit-call';
  } else {
    kind = 'habit-push';
  }

  const rawFire = data?.intendedFireAt;
  const intendedFireAt =
    rawFire != null && Number.isFinite(Number(rawFire)) ? Number(rawFire) : null;

  return {
    kind,
    intendedFireAt,
    slotKey: data?.slotKey,
    habitId: data?.habitId,
    habitName: data?.habitName,
    habitTime: data?.habitTime,
    isRescheduled: data?.isRescheduled === 'true',
  };
}

function occurrenceKey(occ: OccurrenceData): string {
  const slotOrHabit = occ.habitId ?? occ.slotKey ?? occ.habitTime ?? 'reminder';
  return missedKey(occ.kind, occ.intendedFireAt ?? 0, slotOrHabit);
}

/**
 * Called when a reminder is DELIVERED. Returns whether the ringing call UI should be
 * suppressed (because the fire is stale). When not suppressed, records a pending-answer
 * marker so a never-answered call is later recovered as missed.
 */
export async function onCallDelivered(
  occ: OccurrenceData,
  notificationId: string | undefined,
  nowEpoch: number = Date.now(),
): Promise<{ suppress: boolean }> {
  // Can't classify a legacy payload without intendedFireAt — treat as fresh (ring).
  if (occ.intendedFireAt != null) {
    const classification = classifyFire(
      occ.intendedFireAt,
      nowEpoch,
      DEFAULT_STALENESS_THRESHOLD_MS,
    );
    if (classification === 'stale') {
      reminderLog.warn('call.stale_suppressed', 'Suppressed a stale reminder fire', {
        kind: occ.kind,
        intendedFireAt: occ.intendedFireAt,
        latenessMs: nowEpoch - occ.intendedFireAt,
      });
      await recordMissedOccurrence(occ, nowEpoch);
      return { suppress: true };
    }
  }

  await upsertPendingAnswer({
    key: occurrenceKey(occ),
    notificationId: notificationId ?? '',
    kind: occ.kind,
    intendedFireAt: occ.intendedFireAt ?? nowEpoch,
    deadline: (occ.intendedFireAt ?? nowEpoch) + RING_TIMEOUT_MS,
    slotKey: occ.slotKey,
    habit: { habitId: occ.habitId, habitName: occ.habitName, habitTime: occ.habitTime },
  });
  return { suppress: false };
}

export async function onCallAccepted(occ: OccurrenceData): Promise<void> {
  await resolvePendingAnswer(occurrenceKey(occ));
  if (occ.isRescheduled && occ.slotKey) {
    // Reschedule trigger ids are deterministic; clearing the marker is enough here —
    // the reschedule entry is removed by the reconciliation pass once its fireAt passes.
  }
  reminderLog.info('call.accepted', 'Call accepted', { kind: occ.kind });
}

export async function onCallDeclined(occ: OccurrenceData): Promise<void> {
  await resolvePendingAnswer(occurrenceKey(occ));
  if (occ.kind === 'habit-call' || occ.kind === 'habit-push') {
    await reportHabitOccurrence({
      habitId: occ.habitId,
      reminderTime: occ.habitTime,
      status: 'DECLINED',
    });
  }
  reminderLog.info('call.declined', 'Call declined', { kind: occ.kind });
}

async function recordMissedOccurrence(
  occ: OccurrenceData,
  nowEpoch: number,
): Promise<void> {
  const slotOrHabit = occ.habitId ?? occ.slotKey ?? occ.habitTime ?? 'reminder';
  const newly = await recordMissed({
    key: missedKey(occ.kind, occ.intendedFireAt ?? nowEpoch, slotOrHabit),
    kind: occ.kind,
    intendedFireAt: occ.intendedFireAt ?? nowEpoch,
    recordedAt: nowEpoch,
    slotKey: occ.slotKey,
    habit: { habitId: occ.habitId, habitName: occ.habitName, habitTime: occ.habitTime },
  });
  if (newly && (occ.kind === 'habit-call' || occ.kind === 'habit-push')) {
    await reportHabitOccurrence({
      habitId: occ.habitId,
      reminderTime: occ.habitTime,
      status: 'MISSED',
    });
  }
}

/**
 * Converts pending-answer markers past their deadline into recorded misses. Invoked by
 * the reconciliation pass — this is how a call delivered while the app was killed and
 * never answered becomes a surfaced miss.
 */
export async function reconcileExpiredAnswers(nowEpoch: number = Date.now()): Promise<number> {
  const expired = await listExpiredPendingAnswers(nowEpoch);
  let count = 0;
  for (const p of expired) {
    await recordMissedOccurrence(
      {
        kind: p.kind,
        intendedFireAt: p.intendedFireAt,
        slotKey: p.slotKey,
        habitId: p.habit?.habitId,
        habitName: p.habit?.habitName,
        habitTime: p.habit?.habitTime,
        isRescheduled: false,
      },
      nowEpoch,
    );
    await resolvePendingAnswer(p.key);
    count++;
  }
  if (count > 0) {
    reminderLog.info('call.expired_answers', `Resolved ${count} unanswered calls as missed`);
  }
  return count;
}

export { removeReschedule };
