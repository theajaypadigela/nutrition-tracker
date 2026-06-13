/**
 * Meal-schedule persistence (§F). The schedule intent {hour, minute, enabled} is the
 * source of truth; it lives server-side and is mirrored to AsyncStorage as an offline
 * cache. Reinstall / data-clear (allowBackup=false) / second devices converge by
 * syncing from the server on login.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../../api/client';
import { reminderLog } from './logger';
import { resolveDeviceTimeZone } from './time';

export type MealSchedule = {
  hour: number;
  minute: number;
  enabled: boolean;
};

const STORAGE_KEY = 'meal_schedule_v2';

export function defaultMealSchedule(): MealSchedule {
  return { hour: 20, minute: 0, enabled: false };
}

function isValidSchedule(value: unknown): value is MealSchedule {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.hour === 'number' &&
    v.hour >= 0 &&
    v.hour <= 23 &&
    typeof v.minute === 'number' &&
    v.minute >= 0 &&
    v.minute <= 59 &&
    typeof v.enabled === 'boolean'
  );
}

/** Reads the cached schedule. Corrupted storage returns the default (never throws). */
export async function loadMealScheduleCached(): Promise<MealSchedule> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultMealSchedule();
    const parsed = JSON.parse(raw);
    if (!isValidSchedule(parsed)) {
      reminderLog.warn('meal.cache_corrupt', 'Meal schedule cache was invalid; using default');
      await AsyncStorage.removeItem(STORAGE_KEY);
      return defaultMealSchedule();
    }
    return parsed;
  } catch (e) {
    reminderLog.warn('meal.cache_read_failed', 'Meal schedule cache read failed', {
      error: String(e),
    });
    return defaultMealSchedule();
  }
}

export async function saveMealScheduleCached(schedule: MealSchedule): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(schedule));
}

/**
 * Three-state server fetch. We must distinguish "server definitely has no schedule" (404)
 * from "we couldn't reach the server" — treating a transient network error as "absent"
 * would let one device clobber another's saved schedule.
 */
export type MealScheduleFetch =
  | { status: 'found'; schedule: MealSchedule }
  | { status: 'absent' }
  | { status: 'error' };

export async function fetchMealScheduleFromServer(): Promise<MealScheduleFetch> {
  try {
    const res = await apiClient.get('/meal-schedule');
    if (res.data && isValidSchedule(res.data)) {
      return { status: 'found', schedule: res.data };
    }
    return { status: 'absent' };
  } catch (e: any) {
    if (e?.response?.status === 404) {
      return { status: 'absent' };
    }
    reminderLog.warn('meal.server_fetch_failed', 'Could not fetch meal schedule from server', {
      error: String(e?.message ?? e),
    });
    return { status: 'error' };
  }
}

/** Persists the schedule to the server (with device timezone). Returns success. */
export async function pushMealScheduleToServer(schedule: MealSchedule): Promise<boolean> {
  try {
    await apiClient.put('/meal-schedule', {
      ...schedule,
      timezone: resolveDeviceTimeZone(),
    });
    return true;
  } catch (e: any) {
    reminderLog.warn('meal.server_push_failed', 'Could not save meal schedule to server', {
      error: String(e?.message ?? e),
    });
    return false;
  }
}

/**
 * Convergence on login / first launch after restore: prefer the server's schedule,
 * fall back to the cache when the server has none or is unreachable, and back-fill the
 * server from the cache when the server is empty but we have a local schedule.
 */
export async function syncMealScheduleFromServer(): Promise<MealSchedule> {
  const [cached, server] = await Promise.all([
    loadMealScheduleCached(),
    fetchMealScheduleFromServer(),
  ]);

  if (server.status === 'found') {
    await saveMealScheduleCached(server.schedule);
    return server.schedule;
  }

  if (server.status === 'absent') {
    // Server genuinely has no schedule yet; back-fill from the local cache so a second
    // device / reinstall converges. Push even a disabled schedule so an explicit "off"
    // round-trips and is recoverable.
    await pushMealScheduleToServer(cached);
    return cached;
  }

  // status === 'error': server state is unknown. Do NOT push (would risk clobbering a
  // schedule saved on another device); fall back to the cache for this session only.
  return cached;
}
