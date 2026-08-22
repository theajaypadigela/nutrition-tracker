/**
 * Persisted one-shot reschedules ("call me back in 20 minutes") — §A.
 *
 * Reschedules must (a) work across midnight, (b) be replayed if the app restarts before
 * they fire, and (c) live in ONE store. Previously meal reschedules lived in AsyncStorage
 * and habit reschedules lived server-side with no device consumer; this unifies them on
 * device. Each entry carries an absolute fire epoch (no same-day rejection) and enough
 * payload to re-arm the trigger and route the resulting call.
 */

import { createJsonArrayStore } from '../storage/jsonStore';
import { StorageKeys } from '../storage/storageKeys';
import { reminderLog } from './logger';
import { ReminderKind } from './notificationBuilder';

export type RescheduleEntry = {
  /** Notifee trigger id used when armed. */
  id: string;
  kind: ReminderKind;
  /** Absolute epoch (ms) to fire. May be on a later calendar day than created. */
  fireAt: number;
  slotKey?: string;
  habit?: { habitId?: string; habitName?: string; habitTime?: string };
};

function isRescheduleEntry(value: unknown): value is RescheduleEntry {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.fireAt === 'number';
}

const store = createJsonArrayStore<RescheduleEntry>(
  StorageKeys.reminderReschedules,
  isRescheduleEntry,
  {
    onReadFailure: (reason, error) =>
      reminderLog.warn('reschedule.read_failed', 'Reschedule store read failed', {
        reason,
        error: String(error),
      }),
  },
);

/** Adds or replaces a reschedule (keyed by id, so re-rescheduling a slot overwrites). */
export async function upsertReschedule(entry: RescheduleEntry): Promise<void> {
  const all = await store.readAll();
  const next = all.filter(e => e.id !== entry.id);
  next.push(entry);
  await store.writeAll(next);
}

export async function removeReschedule(id: string): Promise<void> {
  const all = await store.readAll();
  await store.writeAll(all.filter(e => e.id !== id));
}

export async function listReschedules(): Promise<RescheduleEntry[]> {
  return store.readAll();
}

/** Future reschedules (fireAt strictly after `nowEpoch`). */
export async function listPendingReschedules(nowEpoch: number): Promise<RescheduleEntry[]> {
  return (await store.readAll()).filter(e => e.fireAt > nowEpoch);
}

/** Reschedules whose fire time has already passed — candidates for missed handling. */
export async function listElapsedReschedules(nowEpoch: number): Promise<RescheduleEntry[]> {
  return (await store.readAll()).filter(e => e.fireAt <= nowEpoch);
}

export async function clearAllReschedules(): Promise<void> {
  await store.clear();
}
