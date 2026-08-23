import apiClient from '@/api/client';
import { HttpClient } from './types';
import { WeeklyNutritionReport } from '@/types/types';

export interface DateRange {
  startDate: string;
  endDate: string;
}

/**
 * Nutrition analytics + per-nutrient tracking config. The analytics responses are loosely
 * shaped on the backend, so the report/summary/insight readers are intentionally `any`-typed
 * at this boundary and refined by the consuming hooks/screens.
 */
export const createNutritionApi = (client: HttpClient = apiClient) => ({
  /** Weekly nutrition report for a date range (GET /food/nutrition/weekly). */
  getWeeklyReport: ({ startDate, endDate }: DateRange) =>
    client
      .get<WeeklyNutritionReport>(
        `/food/nutrition/weekly?startDate=${startDate}&endDate=${endDate}`,
      )
      .then(r => r.data),

  /** All per-nutrient summaries for a date range (GET /food/nutrition/all). */
  getAllNutrients: ({ startDate, endDate }: DateRange) =>
    client
      .get<any[]>(`/food/nutrition/all?startDate=${startDate}&endDate=${endDate}`)
      .then(r => r.data),

  /** AI insights for a date range (GET /food/nutrition/insights). */
  getInsights: ({ startDate, endDate }: DateRange) =>
    client
      .get<any[]>(
        `/food/nutrition/insights?startDate=${startDate}&endDate=${endDate}`,
      )
      .then(r => r.data),

  /** Toggle pin on a nutrient (POST /food/nutrient/:id/pin). */
  pinNutrient: (nutrientId: string) =>
    client.post(`/food/nutrient/${nutrientId}/pin`).then(r => r.data),

  /** Set a daily target for a nutrient (PUT /food/nutrient/:id/target). */
  setNutrientTarget: (nutrientId: string, target: number) =>
    client
      .put(`/food/nutrient/${nutrientId}/target`, { target })
      .then(r => r.data),

  /** Mark foods to avoid for a nutrient (PUT /food/nutrient/:id/avoid). */
  markNutrientAvoid: (nutrientId: string, foods: string[]) =>
    client.put(`/food/nutrient/${nutrientId}/avoid`, { foods }).then(r => r.data),
});

export const nutritionApi = createNutritionApi();
