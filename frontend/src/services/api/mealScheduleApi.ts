import apiClient from '../../api/client';
import { HttpClient } from './types';

/** Meal-reminder schedule intent as the server stores it. */
export interface MealSchedulePayload {
  hour: number;
  minute: number;
  enabled: boolean;
}

/**
 * Meal-schedule endpoints. The reminder layer used to call these through apiClient
 * directly, so the /meal-schedule paths lived outside the API layer that owns every
 * other endpoint string.
 *
 * Note for callers: a GET answers 404 when the user has no schedule yet, which is
 * meaningfully different from an unreachable server. The error is left to propagate so
 * the caller can tell those two apart — treating a network failure as "no schedule"
 * would let one device clobber another's saved schedule.
 */
export const createMealScheduleApi = (client: HttpClient = apiClient) => ({
  /** The saved schedule (GET /meal-schedule). Rejects with a 404 when none exists. */
  get: () =>
    client.get<MealSchedulePayload>('/meal-schedule').then(r => r.data),

  /** Save the schedule with the device timezone (PUT /meal-schedule). */
  save: (schedule: MealSchedulePayload, timezone: string) =>
    client
      .put('/meal-schedule', { ...schedule, timezone })
      .then(r => r.data),
});

export const mealScheduleApi = createMealScheduleApi();
