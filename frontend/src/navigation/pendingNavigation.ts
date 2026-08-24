/**
 * Persisted cross-handler hand-off for notification navigation. A Notifee background handler can
 * run in a headless process which does not share module memory with the UI process, so this value
 * must live in AsyncStorage until the authenticated navigator is ready.
 */

import { ROUTES } from './routeNames';
import type { IncomingCallPayload } from '@/hooks/useIncomingCall';
import { createJsonValueStore } from '@/services/storage/jsonStore';
import { StorageKeys } from '@/services/storage/storageKeys';

export type PendingAcceptNavigation =
  | {
      screen: typeof ROUTES.VOICE_HABIT | typeof ROUTES.VOICE_MEAL_LOG;
      mealSlotId?: string;
      habitId?: string;
      habitName?: string;
      habitTime?: string;
    }
  | {
      screen: typeof ROUTES.INCOMING_CALL;
      payload: IncomingCallPayload;
    };

function isPendingNavigation(value: unknown): value is PendingAcceptNavigation | null {
  if (value === null) return true;
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (
    record.screen === ROUTES.VOICE_HABIT ||
    record.screen === ROUTES.VOICE_MEAL_LOG
  ) {
    return true;
  }
  if (record.screen !== ROUTES.INCOMING_CALL) return false;
  if (!record.payload || typeof record.payload !== 'object') return false;
  const payload = record.payload as Record<string, unknown>;
  return payload.type === 'meal' || payload.type === 'habit';
}

const store = createJsonValueStore<PendingAcceptNavigation | null>(
  StorageKeys.pendingCallNavigation,
  isPendingNavigation,
  () => null,
  { clearWhenInvalid: true, onWriteFailure: () => {} },
);

// Serialize set/take inside one runtime so an AppState consume cannot overtake a headless write.
let operation: Promise<unknown> = Promise.resolve();
let inMemoryPending: PendingAcceptNavigation | null = null;
const listeners = new Set<() => void>();

function enqueue<T>(run: () => Promise<T>): Promise<T> {
  const next = operation.then(run, run);
  operation = next.catch(() => undefined);
  return next;
}

export async function setPendingAcceptNavigation(
  next: PendingAcceptNavigation | null,
): Promise<void> {
  await enqueue(async () => {
    inMemoryPending = next;
    if (next === null) {
      await store.clear().catch(() => {});
    } else {
      await store.write(next);
    }
  });
  listeners.forEach(listener => listener());
}

export async function takePendingAcceptNavigation(): Promise<PendingAcceptNavigation | null> {
  return enqueue(async () => {
    const value = (await store.read()) ?? inMemoryPending;
    inMemoryPending = null;
    if (value) await store.clear().catch(() => {});
    return value;
  });
}

/** Wakes the mounted UI when a same-runtime background handler writes after its first read. */
export function subscribeToPendingNavigation(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
