/**
 * Persisted one-shot reschedules ("call me back in 20 minutes") — §A.
 *
 * Reschedules must (a) work across midnight, (b) be replayed if the app restarts before
 * they fire, and (c) live in ONE store. Previously meal reschedules lived in AsyncStorage
 * and habit reschedules lived server-side with no device consumer; this unifies them on
 * device. Each entry carries an absolute fire epoch (no same-day rejection) and enough
 * payload to re-arm the trigger and route the resulting call.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
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

const STORAGE_KEY = 'reminder_reschedules_v1';

async function readAll(): Promise<RescheduleEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RescheduleEntry =>
        e && typeof e.id === 'string' && typeof e.fireAt === 'number',
    );
  } catch (e) {
    reminderLog.warn('reschedule.read_failed', 'Reschedule store read failed', {
      error: String(e),
    });
    return [];
  }
}

async function writeAll(entries: RescheduleEntry[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/** Adds or replaces a reschedule (keyed by id, so re-rescheduling a slot overwrites). */
export async function upsertReschedule(entry: RescheduleEntry): Promise<void> {
  const all = await readAll();
  const next = all.filter(e => e.id !== entry.id);
  next.push(entry);
  await writeAll(next);
}

export async function removeReschedule(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter(e => e.id !== id));
}

export async function listReschedules(): Promise<RescheduleEntry[]> {
  return readAll();
}

/** Future reschedules (fireAt strictly after `nowEpoch`). */
export async function listPendingReschedules(nowEpoch: number): Promise<RescheduleEntry[]> {
  return (await readAll()).filter(e => e.fireAt > nowEpoch);
}

/** Reschedules whose fire time has already passed — candidates for missed handling. */
export async function listElapsedReschedules(nowEpoch: number): Promise<RescheduleEntry[]> {
  return (await readAll()).filter(e => e.fireAt <= nowEpoch);
}

export async function clearAllReschedules(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
