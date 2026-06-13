import apiClient from '../../api/client';
import { HttpClient } from './types';
import { Habit, HabitVoiceInterpretationResponse } from '../../types/types';

export interface CreateHabitPayload {
  name: string;
  repeatDays: string[];
  reminderTime: string;
  reminderType: string;
}

export interface HabitVoiceResultPayload {
  habitId: string;
  habitName: string;
  habitStatus: string;
  rescheduleMinutes: number | null;
  completedAt?: string | null;
}

/**
 * Habit endpoints used by screens. (Notification-side habit fetching lives in
 * services/notifications/habitStore + habitOccurrenceApi and is intentionally left there.)
 */
export const createHabitApi = (client: HttpClient = apiClient) => ({
  /** Habits scheduled for today (GET /habit/today). */
  getToday: () => client.get<Habit[]>('/habit/today').then(r => r.data),

  /** Create a habit (POST /habit); returns the created habit. */
  create: (payload: CreateHabitPayload) =>
    client.post<Habit>('/habit', payload).then(r => r.data),

  /** Toggle completion for a habit (POST /habit/:id/toggle). */
  toggle: (id: string) => client.post(`/habit/${id}/toggle`).then(r => r.data),

  /** Delete a habit (DELETE /habit/:id). */
  remove: (id: string) => client.delete(`/habit/${id}`).then(r => r.data),

  /** Interpret a voice transcript into a habit status (POST /habit/interpret-voice). */
  interpretVoice: (
    transcriptLines: string[],
    habitName: string,
    habitTime: string,
  ) =>
    client
      .post<HabitVoiceInterpretationResponse>('/habit/interpret-voice', {
        transcriptLines,
        habitName,
        habitTime,
      })
      .then(r => r.data),

  /** Persist a per-habit voice result (POST /habit/voice-result). */
  submitVoiceResult: (payload: HabitVoiceResultPayload) =>
    client.post('/habit/voice-result', payload).then(r => r.data),
});

export const habitApi = createHabitApi();
