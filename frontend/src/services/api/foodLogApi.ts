import { AxiosRequestConfig } from 'axios';
import apiClient from '@/api/client';
import { HttpClient } from './types';
import {
  MealsResponse,
  MealVoiceInterpretationResponse,
} from '@/types/types';

export interface FoodEntryInput {
  name: string;
  quantity: number;
  unit: string;
}

export interface ParseTranscriptResponse {
  entriesLogged?: number;
  duplicateTranscript?: boolean;
}

/**
 * Food-log CRUD + voice-logging endpoints. Date params are local YYYY-MM-DD strings.
 * The voice endpoints accept an optional axios config so callers can supply per-request
 * timeouts (the interpretation/parsing calls are slow).
 */
export const createFoodLogApi = (client: HttpClient = apiClient) => ({
  /** Full food log for a date (GET /food/:date). */
  getLog: (date: string) =>
    client.get<MealsResponse>(`/food/${date}`).then(r => r.data),

  /** Update a single entry (PUT /food/:date/meals/entries/:entryId). */
  updateEntry: (date: string, entryId: string, entry: FoodEntryInput) =>
    client
      .put<MealsResponse>(`/food/${date}/meals/entries/${entryId}`, entry)
      .then(r => r.data),

  /** Delete a single entry (DELETE /food/meals/entries/:entryId). */
  deleteEntry: (entryId: string) =>
    client
      .delete<MealsResponse>(`/food/meals/entries/${entryId}`)
      .then(r => r.data),

  /** Add one or more entries to a meal (POST /food/:date/meals/:mealType/entries). */
  addEntries: (date: string, mealType: string, entries: FoodEntryInput[]) =>
    client
      .post(`/food/${date}/meals/${mealType}/entries`, entries)
      .then(r => r.data),

  /** Interpret a meal voice transcript (POST /food/voice-log/interpret-transcript). */
  interpretTranscript: (
    transcript: string,
    mealSlotId: string | undefined,
    config?: AxiosRequestConfig,
  ) =>
    client
      .post<MealVoiceInterpretationResponse>(
        '/food/voice-log/interpret-transcript',
        { transcript, mealSlotId },
        config,
      )
      .then(r => r.data),

  /** Parse a meal voice transcript into logged entries (POST /food/voice-log/parse-transcript). */
  parseTranscript: (
    transcript: string,
    logDate: string,
    config?: AxiosRequestConfig,
  ) =>
    client
      .post<ParseTranscriptResponse>(
        '/food/voice-log/parse-transcript',
        { transcript, logDate },
        config,
      )
      .then(r => r.data),
});

export const foodLogApi = createFoodLogApi();
