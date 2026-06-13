/**
 * Exactly-once guard for notification actions (§E). A cold-start Accept can be delivered
 * to BOTH onBackgroundEvent and getInitialNotification; without dedupe that starts two
 * Vapi sessions. Each action claims a key `${notificationId}:${action}`; the second
 * claimant within the TTL is rejected. Persisted so the guard holds across the headless
 * handler and the foreground app even on a fresh process.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'reminder_processed_actions_v1';
const TTL_MS = 30_000;

type Entry = { key: string; at: number };

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

async function readAll(now: number): Promise<Entry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e: Entry) => now - e.at < TTL_MS);
  } catch {
    return [];
  }
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
  const entries = await readAll(now);
  if (entries.some(e => e.key === key)) {
    return false;
  }
  entries.push({ key, at: now });
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // If persistence fails we still proceed (better to act than to silently drop).
  }
  return true;
}
