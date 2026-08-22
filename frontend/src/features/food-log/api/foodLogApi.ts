import apiClient from '../../../shared/api/client';
import type { MealType, MealsResponse } from '../../../types/types';
import type { EnrichmentStatus } from '../../../types/types';
import type { FeatureRequestOptions } from '../../api/requestOptions';

export interface FoodEntryRequest {
  name: string;
  quantity: number;
  unit: string;
}

export interface FoodEntryResponse extends FoodEntryRequest {
  id: string;
  mealType: string;
  nutritionResponse: string;
  enrichmentStatus?: EnrichmentStatus;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RangeMealResponse {
  mealType: string;
  entries: FoodEntryResponse[];
}

export interface DayLogResponse {
  foodLogId: string;
  date: string;
  meals: RangeMealResponse[];
}

export const foodLogApi = {
  async addEntries(
    date: string,
    mealType: MealType,
    entries: FoodEntryRequest[],
    options?: FeatureRequestOptions,
  ): Promise<FoodEntryResponse[]> {
    const path = `/food/${date}/meals/${mealType}/entries`;
    const { data } = options
      ? await apiClient.post<FoodEntryResponse[]>(path, entries, options)
      : await apiClient.post<FoodEntryResponse[]>(path, entries);
    return data;
  },

  async getForDate(
    date: string,
    options?: FeatureRequestOptions,
  ): Promise<MealsResponse> {
    const path = `/food/${date}`;
    const { data } = options
      ? await apiClient.get<MealsResponse>(path, options)
      : await apiClient.get<MealsResponse>(path);
    return data;
  },

  async getRange(
    from: string,
    to: string,
    options?: FeatureRequestOptions,
  ): Promise<DayLogResponse[]> {
    const { data } = await apiClient.get<DayLogResponse[]>('/food', {
      params: { from, to },
      ...(options ?? {}),
    });
    return data;
  },

  async updateEntry(
    date: string,
    entryId: string,
    request: FoodEntryRequest,
    options?: FeatureRequestOptions,
  ): Promise<MealsResponse> {
    const path = `/food/${date}/meals/entries/${entryId}`;
    const { data } = options
      ? await apiClient.put<MealsResponse>(path, request, options)
      : await apiClient.put<MealsResponse>(path, request);
    return data;
  },

  async deleteEntry(
    date: string,
    entryId: string,
    options?: FeatureRequestOptions,
  ): Promise<MealsResponse> {
    const path = `/food/${date}/meals/entries/${entryId}`;
    const { data } = options
      ? await apiClient.delete<MealsResponse>(path, options)
      : await apiClient.delete<MealsResponse>(path);
    return data;
  },
};
