/**
 * Habit-definition persistence + server fetch — the missing parity with mealScheduleStore.
 *
 * Habit reminder *intent* (the set of habits, each with reminderTime / repeatDays /
 * reminderType) is what the reconciliation pass arms triggers from. Meal intent already
 * lives both server-side AND in an AsyncStorage cache, so meal reminders arm on every
 * reconciliation regardless of network. Habit intent used to come ONLY from a live
 * `GET /habit` fetch: any failure (server not reachable, request timeout, a cold-start
 * token race, or simply the endpoint not being deployed yet) made `fetchHabitsFromServer`
 * return null and the reconciliation armed ZERO habit triggers — silently, while meal
 * reminders kept firing. That asymmetry is exactly "food reminders work, habit reminders
 * never fire".
 *
 * This module gives habits the same cache-first resilience:
 *   - a successful fetch refreshes the cache and is authoritative (safe to prune against);
 *   - a failed fetch falls back to the last-known cached habit set so triggers still arm;
 *   - the habit create/delete flows seed/prune the cache directly, so a just-created habit
 *     is armable even before (or without) a successful round-trip to the server.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Habit } from '../../types/types';
import { habitApi } from '../api/habitApi';
import { reminderLog } from './logger';
import { resolveDeviceTimeZone } from './time';

const STORAGE_KEY = 'habit_definitions_v1';

/** Minimal shape guard: the fields the scheduler reads must be present and well-typed. */
function isValidHabit(value: unknown): value is Habit {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    v.id.length > 0 &&
    typeof v.name === 'string' &&
    typeof v.reminderTime === 'string' &&
    typeof v.reminderType === 'string' &&
    Array.isArray(v.repeatDays)
  );
}

/** Reads the cached habit set. Corrupted storage returns [] (never throws). */
export async function loadHabitsCached(): Promise<Habit[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      reminderLog.warn('habit.cache_corrupt', 'Habit cache was not an array; clearing');
      await AsyncStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return parsed.filter(isValidHabit);
  } catch (e) {
    reminderLog.warn('habit.cache_read_failed', 'Habit cache read failed', {
      error: String(e),
    });
    return [];
  }
}

export async function saveHabitsCached(habits: Habit[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(habits.filter(isValidHabit)),
    );
  } catch (e) {
    reminderLog.warn('habit.cache_write_failed', 'Habit cache write failed', {
      error: String(e),
    });
  }
}

/** Inserts or replaces one habit in the cache (used by the create/edit flow). */
export async function upsertHabitCached(habit: Habit): Promise<void> {
  if (!isValidHabit(habit)) {
    return;
  }
  const all = await loadHabitsCached();
  const next = all.filter(h => h.id !== habit.id);
  next.push(habit);
  await saveHabitsCached(next);
}

/** Removes one habit from the cache (used by the delete flow). */
export async function removeHabitCached(habitId: string): Promise<void> {
  const all = await loadHabitsCached();
  const next = all.filter(h => h.id !== habitId);
  if (next.length !== all.length) {
    await saveHabitsCached(next);
  }
}

/** Clears the cache entirely (called on logout so habits never leak across accounts). */
export async function clearHabitsCached(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}

/**
 * Fetches all habits for the current user and, on success, refreshes the offline cache.
 *
 * Returns:
 *   - Habit[]  — authoritative server truth (the caller may prune habit triggers against it).
 *   - null     — the fetch failed; the caller should fall back to the cache and MUST NOT
 *                prune habit triggers (we can't tell a real delete from a transient outage).
 *
 * The device timezone is carried so the server keeps "today" computations correct.
 */
export async function fetchHabitsFromServer(): Promise<Habit[] | null> {
  try {
    const data = await habitApi.getAll(resolveDeviceTimeZone());
    if (Array.isArray(data)) {
      const habits = data.filter(isValidHabit);
      await saveHabitsCached(habits);
      return habits;
    }
    // A 2xx with a non-array body is "server reachable, no habits" — authoritative empty.
    await saveHabitsCached([]);
    return [];
  } catch (e: any) {
    reminderLog.warn(
      'reconcile.habit_fetch_failed',
      'Could not fetch habits for reconciliation; will fall back to cache',
      { error: String(e?.message ?? e) },
    );
    return null;
  }
}
