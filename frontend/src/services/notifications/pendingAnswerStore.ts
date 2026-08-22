/**
 * In-flight call tracking (§E missed detection).
 *
 * When a call is DELIVERED we record a "pending answer" marker with a 60s deadline. On
 * Accept/Decline we remove it. Because the marker is persisted, a call that is delivered
 * while the app is killed and never answered (Android's timeoutAfter dismisses it
 * silently, with no event) is still detected at the next launch's reconciliation: any
 * marker past its deadline becomes a recorded miss. This is the launch-time fallback the
 * iOS notes also call for, and it needs no extra triggers.
 */

import { createJsonArrayStore } from '../storage/jsonStore';
import { StorageKeys } from '../storage/storageKeys';
import { reminderLog } from './logger';
import { ReminderKind } from './notificationBuilder';

export type PendingAnswer = {
  /** Per-occurrence key: same scheme as missedStore. */
  key: string;
  notificationId: string;
  kind: ReminderKind;
  intendedFireAt: number;
  /** Epoch after which an unanswered call is considered missed. */
  deadline: number;
  slotKey?: string;
  habit?: { habitId?: string; habitName?: string; habitTime?: string };
};

function isPendingAnswer(value: unknown): value is PendingAnswer {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.key === 'string' &&
    v.key.length > 0 &&
    typeof v.notificationId === 'string' &&
    typeof v.deadline === 'number'
  );
}

const store = createJsonArrayStore<PendingAnswer>(
  StorageKeys.pendingAnswers,
  isPendingAnswer,
  {
    onReadFailure: (reason, error) =>
      reminderLog.warn('pending.read_failed', 'Pending-answer read failed', {
        reason,
        error: String(error),
      }),
  },
);

export async function upsertPendingAnswer(entry: PendingAnswer): Promise<void> {
  const all = await store.readAll();
  const next = all.filter(e => e.key !== entry.key);
  next.push(entry);
  await store.writeAll(next);
}

export async function resolvePendingAnswer(key: string): Promise<void> {
  const all = await store.readAll();
  await store.writeAll(all.filter(e => e.key !== key));
}

/** Pending answers whose deadline has passed -> these are missed. */
export async function listExpiredPendingAnswers(nowEpoch: number): Promise<PendingAnswer[]> {
  return (await store.readAll()).filter(e => e.deadline <= nowEpoch);
}

export async function listPendingAnswers(): Promise<PendingAnswer[]> {
  return store.readAll();
}

export async function clearPendingAnswers(): Promise<void> {
  await store.clear();
}
