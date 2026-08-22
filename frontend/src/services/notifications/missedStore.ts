/**
 * Missed-occurrence records (§E). Every terminal "missed" state (60s ring timeout,
 * Android-14 dismissal, stale reboot-replayed alarm, or an elapsed reschedule the app
 * couldn't fire while killed) is recorded here so we can show a missed-call follow-up
 * and never drop the occurrence silently. Deduped by a per-occurrence key so the same
 * miss isn't surfaced twice across reconciliation passes.
 */

import { createJsonArrayStore } from '../storage/jsonStore';
import { StorageKeys } from '../storage/storageKeys';
import { reminderLog } from './logger';
import { ReminderKind } from './notificationBuilder';

export type MissedRecord = {
  /** Stable per-occurrence key: `${kind}:${slotKey|habitId}:${intendedFireAt}`. */
  key: string;
  kind: ReminderKind;
  intendedFireAt: number;
  recordedAt: number;
  slotKey?: string;
  habit?: { habitId?: string; habitName?: string; habitTime?: string };
  /** Set once the follow-up notification has been shown so we don't re-show it. */
  followUpShown?: boolean;
};

const MAX_RECORDS = 50;

function isMissedRecord(value: unknown): value is MissedRecord {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.key === 'string' &&
    v.key.length > 0 &&
    typeof v.kind === 'string' &&
    typeof v.intendedFireAt === 'number'
  );
}

const store = createJsonArrayStore<MissedRecord>(
  StorageKeys.missedReminders,
  isMissedRecord,
  {
    // Bound storage: oldest records fall off first.
    max: MAX_RECORDS,
    order: (a, b) => a.intendedFireAt - b.intendedFireAt,
    onReadFailure: (reason, error) =>
      reminderLog.warn('missed.read_failed', 'Missed store read failed', {
        reason,
        error: String(error),
      }),
  },
);


export function missedKey(
  kind: ReminderKind,
  intendedFireAt: number,
  slotOrHabit: string,
): string {
  return `${kind}:${slotOrHabit}:${intendedFireAt}`;
}

/** Records a miss if not already present. Returns true if newly recorded. */
export async function recordMissed(record: MissedRecord): Promise<boolean> {
  const all = await store.readAll();
  if (all.some(r => r.key === record.key)) {
    return false;
  }
  all.push(record);
  await store.writeAll(all);
  reminderLog.info('missed.recorded', 'Recorded missed reminder', {
    key: record.key,
    kind: record.kind,
  });
  return true;
}

export async function markFollowUpShown(key: string): Promise<void> {
  const all = await store.readAll();
  const next = all.map(r => (r.key === key ? { ...r, followUpShown: true } : r));
  await store.writeAll(next);
}

export async function listMissedNeedingFollowUp(): Promise<MissedRecord[]> {
  return (await store.readAll()).filter(r => !r.followUpShown);
}

export async function listAllMissed(): Promise<MissedRecord[]> {
  return store.readAll();
}

export async function clearMissed(): Promise<void> {
  await store.clear();
}
