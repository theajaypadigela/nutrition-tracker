/**
 * Exactly-once guard for notification actions (§E). A cold-start Accept can be delivered
 * to BOTH onBackgroundEvent and getInitialNotification; without dedupe that starts two
 * Vapi sessions. Each action claims a key `${notificationId}:${action}`; the second
 * claimant within the TTL is rejected. Persisted so the guard holds across the headless
 * handler and the foreground app even on a fresh process.
 */

import { createJsonArrayStore } from '../storage/jsonStore';
import { StorageKeys } from '../storage/storageKeys';

const TTL_MS = 30_000;

type Entry = { key: string; at: number };

function isEntry(value: unknown): value is Entry {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.key === 'string' && typeof v.at === 'number';
}

// No failure reporting on purpose: this is a best-effort dedupe backstop, and a
// storage hiccup must never stop an action the user just tapped.
const store = createJsonArrayStore<Entry>(StorageKeys.processedActions, isEntry, {
  onWriteFailure: () => {},
});

// Synchronous in-memory claim set. Notifee's headless background handler and the
// foreground app share a single RN JS runtime, so a synchronous check-and-set here is
// atomic with respect to that thread — this closes the read/await/write TOCTOU window
// that the persisted store alone leaves open when both paths run on one cold start.
const inMemoryClaims = new Map<string, number>();

function claimInMemory(key: string, now: number): boolean {
  // Prune expired entries.
  for (const [k, at] of inMemoryClaims) {
    if (now - at >= TTL_MS) inMemoryClaims.delete(k);
  }
  if (inMemoryClaims.has(key)) {
    return false;
  }
  inMemoryClaims.set(key, now);
  return true;
}

/** Persisted claims still inside the TTL. */
async function readUnexpired(now: number): Promise<Entry[]> {
  return (await store.readAll()).filter(e => now - e.at < TTL_MS);
}

/**
 * Claims an action key exactly once. Returns true for the first caller within the TTL,
 * false afterwards. The synchronous in-memory claim is the authority within a single app
 * runtime (where the cold-start double-handling race lives); the persisted store is the
 * backstop across separate launches.
 */
export async function claimAction(
  key: string,
  now: number = Date.now(),
): Promise<boolean> {
  // Synchronous, atomic w.r.t. the JS thread — decides the same-runtime race immediately.
  if (!claimInMemory(key, now)) {
    return false;
  }
  // Persisted backstop for the cross-launch case (in-memory is empty on a fresh process).
  const entries = await readUnexpired(now);
  if (entries.some(e => e.key === key)) {
    return false;
  }
  entries.push({ key, at: now });
  // A failed write is swallowed by the store: better to act than to silently drop.
  await store.writeAll(entries);
  return true;
}
