/**
 * Missed-occurrence records (§E). Every terminal "missed" state (60s ring timeout,
 * Android-14 dismissal, stale reboot-replayed alarm, or an elapsed reschedule the app
 * couldn't fire while killed) is recorded here so we can show a missed-call follow-up
 * and never drop the occurrence silently. Deduped by a per-occurrence key so the same
 * miss isn't surfaced twice across reconciliation passes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
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

const STORAGE_KEY = 'reminder_missed_v1';
const MAX_RECORDS = 50;

async function readAll(): Promise<MissedRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    reminderLog.warn('missed.read_failed', 'Missed store read failed', { error: String(e) });
    return [];
  }
}

async function writeAll(records: MissedRecord[]): Promise<void> {
  // Keep only the most recent MAX_RECORDS to bound storage.
  const trimmed = records
    .sort((a, b) => a.intendedFireAt - b.intendedFireAt)
    .slice(-MAX_RECORDS);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function missedKey(
  kind: ReminderKind,
  intendedFireAt: number,
  slotOrHabit: string,
): string {
  return `${kind}:${slotOrHabit}:${intendedFireAt}`;
}

/** Records a miss if not already present. Returns true if newly recorded. */
export async function recordMissed(record: MissedRecord): Promise<boolean> {
  const all = await readAll();
  if (all.some(r => r.key === record.key)) {
    return false;
  }
  all.push(record);
  await writeAll(all);
  reminderLog.info('missed.recorded', 'Recorded missed reminder', {
    key: record.key,
    kind: record.kind,
  });
  return true;
}

export async function markFollowUpShown(key: string): Promise<void> {
  const all = await readAll();
  const next = all.map(r => (r.key === key ? { ...r, followUpShown: true } : r));
  await writeAll(next);
}

export async function listMissedNeedingFollowUp(): Promise<MissedRecord[]> {
  return (await readAll()).filter(r => !r.followUpShown);
}

export async function listAllMissed(): Promise<MissedRecord[]> {
  return readAll();
}

export async function clearMissed(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
