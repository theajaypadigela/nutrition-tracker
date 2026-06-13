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

import AsyncStorage from '@react-native-async-storage/async-storage';
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

const STORAGE_KEY = 'reminder_pending_answers_v1';

async function readAll(): Promise<PendingAnswer[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    reminderLog.warn('pending.read_failed', 'Pending-answer read failed', { error: String(e) });
    return [];
  }
}

async function writeAll(entries: PendingAnswer[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export async function upsertPendingAnswer(entry: PendingAnswer): Promise<void> {
  const all = await readAll();
  const next = all.filter(e => e.key !== entry.key);
  next.push(entry);
  await writeAll(next);
}

export async function resolvePendingAnswer(key: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter(e => e.key !== key));
}

/** Pending answers whose deadline has passed -> these are missed. */
export async function listExpiredPendingAnswers(nowEpoch: number): Promise<PendingAnswer[]> {
  return (await readAll()).filter(e => e.deadline <= nowEpoch);
}

export async function listPendingAnswers(): Promise<PendingAnswer[]> {
  return readAll();
}

export async function clearPendingAnswers(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
