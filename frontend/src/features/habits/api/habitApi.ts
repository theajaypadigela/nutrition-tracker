import apiClient from '../../../shared/api/client';
import type { Habit } from '../../../types/types';
import type { FeatureRequestOptions } from '../../api/requestOptions';

export type HabitReminderType = 'notification' | 'call' | 'none';

export interface CreateHabitRequest {
  name: string;
  repeatDays: string[];
  reminderTime: string;
  reminderType: HabitReminderType;
}

export interface CreatedHabitResponse {
  id: string | number;
  name: string;
  repeatDays: string[];
  reminderTime: string;
  reminderType: HabitReminderType;
}

export interface ToggleHabitRequest {
  habit: Habit | undefined;
}

export interface HabitVoiceResultRequest {
  habitId: number;
  habitName: string;
  habitStatus: 'completed' | 'not_completed' | 'rescheduled';
  rescheduleMinutes: number | null;
  completedAt?: string | null;
}

export const habitApi = {
  async create(
    request: CreateHabitRequest,
    options?: FeatureRequestOptions,
  ): Promise<CreatedHabitResponse> {
    const { data } = options
      ? await apiClient.post<CreatedHabitResponse>('/habit', request, options)
      : await apiClient.post<CreatedHabitResponse>('/habit', request);
    return data;
  },

  async getToday(options?: FeatureRequestOptions): Promise<Habit[]> {
    const { data } = options
      ? await apiClient.get<Habit[]>('/habit/today', options)
      : await apiClient.get<Habit[]>('/habit/today');
    return data;
  },

  async getAll(options?: FeatureRequestOptions): Promise<Habit[]> {
    const { data } = options
      ? await apiClient.get<Habit[]>('/habit', options)
      : await apiClient.get<Habit[]>('/habit');
    return data;
  },

  async toggle(
    id: string | number,
    request: ToggleHabitRequest,
    options?: FeatureRequestOptions,
  ): Promise<void> {
    if (options) {
      await apiClient.post(`/habit/${id}/toggle`, request, options);
      return;
    }
    await apiClient.post(`/habit/${id}/toggle`, request);
  },

  async delete(
    id: string | number,
    options?: FeatureRequestOptions,
  ): Promise<void> {
    if (options) {
      await apiClient.delete(`/habit/${id}`, options);
      return;
    }
    await apiClient.delete(`/habit/${id}`);
  },

  async recordVoiceResult(
    request: HabitVoiceResultRequest,
    options?: FeatureRequestOptions,
  ): Promise<Habit> {
    const { data } = options
      ? await apiClient.post<Habit>('/habit/voice-result', request, options)
      : await apiClient.post<Habit>('/habit/voice-result', request);
    return data;
  },
};
