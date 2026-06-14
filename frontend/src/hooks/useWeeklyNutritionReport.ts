import { useCallback, useEffect, useState } from 'react';
import { nutritionApi } from '../services/api/nutritionApi';
import {
  Insight,
  AllNutrientSummary,
} from '../components/nutrition-report/types';
import { WeeklyNutritionReport } from '../types/types';
import { DAYS_IN_WEEK, getCurrentSundayToSaturdayRange } from '../utils/weekRange';

interface InsightApiResponse {
  variant: 'positive' | 'negative' | 'neutral';
  message: string;
}

const DAILY_GOALS = {
  calories: 2500,
  protein: 180,
  carbs: 250,
  fat: 70,
  sugar: 40,
  fiber: 30,
  sodium: 2300,
};

const EMPTY_STATE_INSIGHT: Insight = {
  variant: 'neutral',
  message: 'Log your meals to get personalized insights.',
};

const hasNutritionData = (report: WeeklyNutritionReport | null): boolean => {
  if (!report?.weeklyTotals) return false;
  const { calories, protein, carbs, fat, fiber, sugar, sodium } =
    report.weeklyTotals;
  return [calories, protein, carbs, fat, fiber, sugar, sodium].some(
    value => (value ?? 0) > 0,
  );
};

const buildGoal = (dailyGoal: number, daysElapsed: number) => ({
  goal: dailyGoal * daysElapsed,
  weeklyGoal: dailyGoal * DAYS_IN_WEEK,
});

/**
 * Owns the weekly nutrition report screen's three data flows (weekly report, all-nutrient
 * summaries, AI insights with rule-based fallback) and the derived macro/micro/calorie
 * view-model. NutritionReportScreen renders from this and stays presentation-only.
 */
export function useWeeklyNutritionReport() {
  const [reportData, setReportData] = useState<WeeklyNutritionReport | null>(
    null,
  );
  const [allNutrients, setAllNutrients] = useState<AllNutrientSummary[]>([]);
  const [aiInsights, setAiInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadWeeklyReport = useCallback(async () => {
    setLoading(true);
    try {
      const range = getCurrentSundayToSaturdayRange();
      const result = await nutritionApi.getWeeklyReport(range);
      if (result) setReportData(result);
    } catch (error) {
      console.error('Failed to load weekly nutrition report:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNutrientSummaries = useCallback(async () => {
    try {
      const range = getCurrentSundayToSaturdayRange();
      const result = await nutritionApi.getAllNutrients(range);
      if (Array.isArray(result)) {
        setAllNutrients(result);
      }
    } catch (error) {
      console.error('Failed to load nutrient summaries:', error);
    }
  }, []);

  const reload = useCallback(async () => {
    await Promise.all([loadWeeklyReport(), loadNutrientSummaries()]);
  }, [loadWeeklyReport, loadNutrientSummaries]);

  const generateFallbackInsights = useCallback((): Insight[] => {
    if (!reportData) {
      return [
        {
          variant: 'neutral',
          message: 'Start logging your meals to get personalized insights!',
        },
      ];
    }

    const insights: Insight[] = [];
    const { weeklyAverage } = reportData;

    if (weeklyAverage.fiber < 25) {
      insights.push({
        variant: 'negative',
        message:
          'Fiber low this week - add oats, veggies and fruits to your diet',
      });
    }
    if (weeklyAverage.sugar > 50) {
      insights.push({
        variant: 'negative',
        message: 'Sugar high this week - reduce sugary drinks and desserts',
      });
    }
    if (weeklyAverage.protein >= 150) {
      insights.push({ variant: 'positive', message: 'Great protein intake!' });
    } else if (weeklyAverage.protein < 120) {
      insights.push({
        variant: 'neutral',
        message: 'Consider adding more protein to your diet',
      });
    }

    return insights.length > 0
      ? insights
      : [
          {
            variant: 'neutral',
            message: 'Start logging your meals to get personalized insights!',
          },
        ];
  }, [reportData]);

  const fetchAiInsights = useCallback(async () => {
    if (!hasNutritionData(reportData)) {
      setAiInsights([]);
      setInsightsError(null);
      setUsingFallback(false);
      setInsightsLoading(false);
      return;
    }

    setInsightsLoading(true);
    setInsightsError(null);
    setUsingFallback(false);
    try {
      const range = getCurrentSundayToSaturdayRange();
      const result = await nutritionApi.getInsights(range);
      if (result && Array.isArray(result)) {
        setAiInsights(
          (result as InsightApiResponse[]).map(r => ({
            variant: r.variant,
            message: r.message,
          })),
        );
        setUsingFallback(false);
      }
    } catch (error: any) {
      console.error('Failed to load AI insights:', error);
      setInsightsError(
        error?.message ||
          'Failed to load AI insights. Showing rule-based insights.',
      );
      if (reportData) {
        setAiInsights(generateFallbackInsights());
        setUsingFallback(true);
      }
    } finally {
      setInsightsLoading(false);
    }
  }, [reportData, generateFallbackInsights]);

  useEffect(() => {
    if (hasNutritionData(reportData)) {
      fetchAiInsights();
      return;
    }
    setAiInsights([]);
    setInsightsError(null);
    setUsingFallback(false);
    setInsightsLoading(false);
  }, [reportData, fetchAiInsights]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const { daysElapsed } = getCurrentSundayToSaturdayRange();

  const getSummaryTotal = useCallback(
    (id: string): number => {
      const nutrient = allNutrients.find(n => n.id === id);
      if (!nutrient) return 0;
      if (Array.isArray(nutrient.trend) && nutrient.trend.length > 0) {
        return nutrient.trend.reduce((total, value) => total + value, 0);
      }
      const dailyAverage = nutrient.value ?? nutrient.weeklyAvg ?? 0;
      return dailyAverage * daysElapsed;
    },
    [allNutrients, daysElapsed],
  );

  const preferNonZero = (primary: number, fallback: number) =>
    primary > 0 ? primary : fallback;

  const current = (key: keyof WeeklyNutritionReport['weeklyTotals'], id: string) =>
    preferNonZero(
      Math.round(reportData?.weeklyTotals?.[key] ?? 0),
      Math.round(getSummaryTotal(id)),
    );

  const caloriesSoFar = current('calories', 'calories');
  const proratedCalorieGoal = DAILY_GOALS.calories * daysElapsed;
  const weeklyCalorieGoal = DAILY_GOALS.calories * DAYS_IN_WEEK;

  const macroNutrients = {
    protein: { current: current('protein', 'protein'), ...buildGoal(DAILY_GOALS.protein, daysElapsed) },
    carbs: { current: current('carbs', 'carbs'), ...buildGoal(DAILY_GOALS.carbs, daysElapsed) },
    fats: { current: current('fat', 'fat'), ...buildGoal(DAILY_GOALS.fat, daysElapsed) },
  };

  const microNutrients = {
    sugar: { current: current('sugar', 'sugar'), ...buildGoal(DAILY_GOALS.sugar, daysElapsed) },
    fiber: { current: current('fiber', 'fiber'), ...buildGoal(DAILY_GOALS.fiber, daysElapsed) },
    sodium: { current: current('sodium', 'sodium'), ...buildGoal(DAILY_GOALS.sodium, daysElapsed) },
  };

  const canShowInsights = hasNutritionData(reportData);
  const displayInsights = canShowInsights
    ? aiInsights.length > 0
      ? aiInsights
      : generateFallbackInsights()
    : [EMPTY_STATE_INSIGHT];

  return {
    reportData,
    loading,
    refreshing,
    reload,
    handleRefresh,
    fetchAiInsights,
    insightsLoading,
    insightsError,
    usingFallback,
    canShowInsights,
    displayInsights,
    daysElapsed,
    caloriesSoFar,
    proratedCalorieGoal,
    weeklyCalorieGoal,
    macroNutrients,
    microNutrients,
  };
}
