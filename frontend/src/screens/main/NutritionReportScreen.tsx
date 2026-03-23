import {
  View,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { VStack } from '../../components/ui/vstack';
import { HStack } from '../../components/ui/hstack';
import React, { useEffect, useState, useCallback } from 'react';
import CaloriesSummaryCard from '../../components/nutrition-report/CaloriesSummaryCard';
import MacroNutrientsSection from '../../components/nutrition-report/MacroNutrientsSection';
import MicroNutrientsSection from '../../components/nutrition-report/MicroNutrientsSection';
import { Lightbulb, RefreshCw } from 'lucide-react-native';
import { Text } from '../../components/ui/text';
import InsightsBadge from '../../components/nutrition-report/InsightsBadge';
import AllNutritionsCard from '../../components/nutrition-report/AllNutritionsCard';
import {
  Insight,
  AllNutrientSummary,
} from '../../components/nutrition-report/types';
import AppBar from '../../components/AppBar';
import useApi from '../../hooks/useApi';
import { WeeklyNutritionReport } from '../../types/types';

interface InsightApiResponse {
  variant: 'positive' | 'negative' | 'neutral';
  message: string;
}

const NutritionReportScreen = () => {
  const { data, request, loading } = useApi<WeeklyNutritionReport>();
  const nutrientSummaryApi = useApi<AllNutrientSummary[]>();
  const { request: nutrientSummaryRequest } = nutrientSummaryApi;
  const insightsApi = useApi<InsightApiResponse[]>();
  const { request: insightsRequest } = insightsApi;
  const [reportData, setReportData] = useState<WeeklyNutritionReport | null>(
    null,
  );
  const [allNutrients, setAllNutrients] = useState<AllNutrientSummary[]>([]);
  const [aiInsights, setAiInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Get date range for the past 7 days
  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 6); // Last 7 days

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  };

  const loadWeeklyReport = useCallback(async () => {
    try {
      const { startDate, endDate } = getDateRange();
      await request({
        url: `/food/nutrition/weekly?startDate=${startDate}&endDate=${endDate}`,
        method: 'GET',
      });
    } catch (error) {
      console.error('Failed to load weekly nutrition report:', error);
    }
  }, [request]);

  const loadNutrientSummaries = useCallback(async () => {
    try {
      const { startDate, endDate } = getDateRange();
      const result = await nutrientSummaryRequest({
        url: `/food/nutrition/all?startDate=${startDate}&endDate=${endDate}`,
        method: 'GET',
      });
      if (Array.isArray(result)) {
        setAllNutrients(result);
      }
    } catch (error) {
      console.error('Failed to load nutrient summaries:', error);
    }
  }, [nutrientSummaryRequest]);

  useEffect(() => {
    loadWeeklyReport();
    loadNutrientSummaries();
  }, [loadWeeklyReport, loadNutrientSummaries]);

  useEffect(() => {
    if (data) {
      setReportData(data);
    }
  }, [data]);

  // Fallback rule-based insights
  const generateFallbackInsights = useCallback((): Insight[] => {
    const insights: Insight[] = [];
    if (!reportData) {
      return [
        {
          variant: 'neutral',
          message: 'Start logging your meals to get personalized insights!',
        },
      ];
    }

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
      insights.push({
        variant: 'positive',
        message: 'Great protein intake!',
      });
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

  // Fetch AI Insights
  const fetchAiInsights = useCallback(async () => {
    setInsightsLoading(true);
    setInsightsError(null);
    setUsingFallback(false);
    try {
      const { startDate, endDate } = getDateRange();
      const result = await insightsRequest({
        url: `/food/nutrition/insights?startDate=${startDate}&endDate=${endDate}`,
        method: 'GET',
      });
      if (result && Array.isArray(result)) {
        setAiInsights(
          result.map((r: InsightApiResponse) => ({
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
      // Fallback to rule-based insights
      if (reportData) {
        const fallbackInsights = generateFallbackInsights();
        setAiInsights(fallbackInsights);
        setUsingFallback(true);
      }
    } finally {
      setInsightsLoading(false);
    }
  }, [insightsRequest, reportData, generateFallbackInsights]);

  useEffect(() => {
    if (reportData) {
      fetchAiInsights();
    }
  }, [reportData, fetchAiInsights]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadWeeklyReport(),
      loadNutrientSummaries(),
      fetchAiInsights(),
    ]);
    setRefreshing(false);
  }, [loadWeeklyReport, loadNutrientSummaries, fetchAiInsights]);

  const displayInsights =
    aiInsights.length > 0 ? aiInsights : generateFallbackInsights();

  const getSummaryValue = useCallback(
    (id: string): number => {
      const nutrient = allNutrients.find(n => n.id === id);
      if (!nutrient) {
        return 0;
      }
      return nutrient.value ?? nutrient.weeklyAvg ?? 0;
    },
    [allNutrients],
  );

  const preferNonZero = (primary: number, fallback: number) =>
    primary > 0 ? primary : fallback;

  // Use real data if available, otherwise show defaults
  const weeklyAvgCalories = preferNonZero(
    Math.round(reportData?.avgDailyCalories ?? 0),
    Math.round(getSummaryValue('calories')),
  );
  const dailyCalorieGoal = 2500;

  const proteinCurrent = preferNonZero(
    Math.round(reportData?.weeklyAverage?.protein ?? 0),
    Math.round(getSummaryValue('protein')),
  );
  const carbsCurrent = preferNonZero(
    Math.round(reportData?.weeklyAverage?.carbs ?? 0),
    Math.round(getSummaryValue('carbs')),
  );
  const fatCurrent = preferNonZero(
    Math.round(reportData?.weeklyAverage?.fat ?? 0),
    Math.round(getSummaryValue('fat')),
  );
  const sugarCurrent = preferNonZero(
    Math.round(reportData?.weeklyAverage?.sugar ?? 0),
    Math.round(getSummaryValue('sugar')),
  );
  const fiberCurrent = preferNonZero(
    Math.round(reportData?.weeklyAverage?.fiber ?? 0),
    Math.round(getSummaryValue('fiber')),
  );
  const sodiumCurrent = preferNonZero(
    Math.round(reportData?.weeklyAverage?.sodium ?? 0),
    Math.round(getSummaryValue('sodium')),
  );

  const macroNutrients = {
    protein: {
      current: proteinCurrent,
      goal: 180,
    },
    carbs: {
      current: carbsCurrent,
      goal: 250,
    },
    fats: {
      current: fatCurrent,
      goal: 70,
    },
  };

  const microNutrients = {
    sugar: {
      current: sugarCurrent,
      goal: 40,
    },
    fiber: {
      current: fiberCurrent,
      goal: 30,
    },
    sodium: {
      current: sodiumCurrent,
      goal: 2300,
    },
  };

  return (
    <View className="flex-1">
      <AppBar title="Nutrition Report" />
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0284c7" />
          <Text className="mt-4 text-gray-600">Loading nutrition data...</Text>
        </View>
      ) : (
        <AllNutritionsCard
          refreshing={refreshing}
          onRefresh={handleRefresh}
          listHeaderComponent={
            <>
              <VStack className="p-6 gap-6">
                <CaloriesSummaryCard
                  weeklyAvgCalories={weeklyAvgCalories}
                  dailyCalorieGoal={dailyCalorieGoal}
                />
                <MacroNutrientsSection macroNutrients={macroNutrients} />
              </VStack>

              <MicroNutrientsSection microNutrients={microNutrients} />

              <VStack className="p-6 bg-white border rounded-2xl border-gray-200 m-6 gap-4">
                <HStack className="gap-2 items-center justify-between">
                  <HStack className="gap-2 items-center">
                    <Lightbulb size={20} color={'#d97706'} />
                    <Text size="md" className="font-bold">
                      {usingFallback ? 'Smart Insights' : 'AI Insights'}
                    </Text>
                    {insightsLoading && (
                      <ActivityIndicator size="small" color="#d97706" />
                    )}
                  </HStack>
                  {!insightsLoading && reportData && (
                    <TouchableOpacity onPress={fetchAiInsights} className="p-2">
                      <RefreshCw size={18} color="#d97706" />
                    </TouchableOpacity>
                  )}
                </HStack>

                {insightsError && !insightsLoading && (
                  <View className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <Text size="sm" className="text-amber-800">
                      {usingFallback
                        ? 'AI insights temporarily unavailable. Showing smart recommendations.'
                        : insightsError}
                    </Text>
                  </View>
                )}

                {displayInsights.map((insight, index) => (
                  <InsightsBadge
                    key={index}
                    variant={insight.variant}
                    message={insight.message}
                  />
                ))}
              </VStack>
            </>
          }
          ListFooterComponent={<View style={styles.listFooter} />}
        />
      )}
    </View>
  );
};

export default NutritionReportScreen;

const styles = StyleSheet.create({
  listFooter: {
    height: 120,
  },
});
