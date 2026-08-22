import apiClient from '../../../shared/api/client';
import type { WeeklyNutritionReport } from '../../../types/types';
import type { FeatureRequestOptions } from '../../api/requestOptions';
import type { AllNutrientSummary, InsightVariant } from './contracts';

export interface NutritionDateRange {
  startDate: string;
  endDate: string;
}

export interface NutritionInsightResponse {
  variant: InsightVariant;
  message: string;
}

export interface NutrientPreferenceResponse {
  nutrientId: string;
  pinned: boolean;
  customTarget: number | null;
  avoidedFoods: string[] | null;
}

export const nutritionReportApi = {
  async getWeekly(
    range: NutritionDateRange,
    options?: FeatureRequestOptions,
  ): Promise<WeeklyNutritionReport> {
    const { data } = await apiClient.get<WeeklyNutritionReport>(
      '/food/nutrition/weekly',
      { params: range, ...(options ?? {}) },
    );
    return data;
  },

  async getAll(
    range: NutritionDateRange,
    options?: FeatureRequestOptions,
  ): Promise<AllNutrientSummary[]> {
    const { data } = await apiClient.get<AllNutrientSummary[]>(
      '/food/nutrition/all',
      { params: range, ...(options ?? {}) },
    );
    return data;
  },

  async getInsights(
    range: NutritionDateRange,
    options?: FeatureRequestOptions,
  ): Promise<NutritionInsightResponse[]> {
    const { data } = await apiClient.get<NutritionInsightResponse[]>(
      '/food/nutrition/insights',
      { params: range, ...(options ?? {}) },
    );
    return data;
  },

  async togglePin(
    nutrientId: string,
    options?: FeatureRequestOptions,
  ): Promise<NutrientPreferenceResponse> {
    const path = `/food/nutrient/${nutrientId}/pin`;
    const { data } = options
      ? await apiClient.post<NutrientPreferenceResponse>(
          path,
          undefined,
          options,
        )
      : await apiClient.post<NutrientPreferenceResponse>(path);
    return data;
  },

  async setTarget(
    nutrientId: string,
    target: number,
    options?: FeatureRequestOptions,
  ): Promise<NutrientPreferenceResponse> {
    const path = `/food/nutrient/${nutrientId}/target`;
    const request = { target };
    const { data } = options
      ? await apiClient.put<NutrientPreferenceResponse>(path, request, options)
      : await apiClient.put<NutrientPreferenceResponse>(path, request);
    return data;
  },

  async setAvoidedFoods(
    nutrientId: string,
    foods: string[],
    options?: FeatureRequestOptions,
  ): Promise<NutrientPreferenceResponse> {
    const path = `/food/nutrient/${nutrientId}/avoid`;
    const request = { foods };
    const { data } = options
      ? await apiClient.put<NutrientPreferenceResponse>(path, request, options)
      : await apiClient.put<NutrientPreferenceResponse>(path, request);
    return data;
  },

  async getPreferences(
    options?: FeatureRequestOptions,
  ): Promise<NutrientPreferenceResponse[]> {
    const { data } = options
      ? await apiClient.get<NutrientPreferenceResponse[]>(
          '/food/nutrient/preferences',
          options,
        )
      : await apiClient.get<NutrientPreferenceResponse[]>(
          '/food/nutrient/preferences',
        );
    return data;
  },
};

export type { AllNutrientSummary, InsightVariant } from './contracts';
export type { WeeklyNutritionReport } from '../../../types/types';
