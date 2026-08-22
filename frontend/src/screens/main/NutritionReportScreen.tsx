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
import { Insight } from '../../components/nutrition-report/types';
import AppBar from '../../components/AppBar';
import { WeeklyNutritionReport } from '../../types/types';
import { trailingLocalDateRange } from '../../shared/date-time/localDate';
import {
  nutritionReportApi,
  NutritionInsightResponse,
} from '../../features/nutrition-report/api/nutritionReportApi';
import { getErrorMessage } from '../../shared/errors/getErrorMessage';
import { useApiOperation } from '../../features/api/useApiOperation';

const NutritionReportScreen = () => {
  const [reportData, setReportData] = useState<WeeklyNutritionReport | null>(
    null,
  );
  const { execute: executeReportRequest, loading } = useApiOperation();
  const { execute: executeInsightsRequest } = useApiOperation();
  const [aiInsights, setAiInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Get date range for the past 7 days
  const getDateRange = () => trailingLocalDateRange(7);

  const loadWeeklyReport = useCallback(async () => {
    try {
      const report = await executeReportRequest(signal =>
        nutritionReportApi.getWeekly(getDateRange(), { signal }),
      );
      setReportData(report);
    } catch (error) {
      console.error('Failed to load weekly nutrition report:', error);
    }
  }, [executeReportRequest]);

  useEffect(() => {
    loadWeeklyReport();
  }, [loadWeeklyReport]);

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
      const result = await executeInsightsRequest(signal =>
        nutritionReportApi.getInsights(getDateRange(), { signal }),
      );
      if (result && Array.isArray(result)) {
        setAiInsights(
          result.map((r: NutritionInsightResponse) => ({
            variant: r.variant,
            message: r.message,
          })),
        );
        setUsingFallback(false);
      }
    } catch (error: unknown) {
      console.error('Failed to load AI insights:', error);
      setInsightsError(
        getErrorMessage(
          error,
          'Failed to load AI insights. Showing rule-based insights.',
        ),
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
  }, [executeInsightsRequest, reportData, generateFallbackInsights]);

  useEffect(() => {
    if (reportData) {
      fetchAiInsights();
    }
  }, [reportData, fetchAiInsights]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadWeeklyReport(), fetchAiInsights()]);
    setRefreshing(false);
  }, [loadWeeklyReport, fetchAiInsights]);

  const displayInsights =
    aiInsights.length > 0 ? aiInsights : generateFallbackInsights();

  // Use real data if available, otherwise show defaults
  const weeklyAvgCalories = reportData?.avgDailyCalories ?? 0;
  const dailyCalorieGoal = 2500;

  const macroNutrients = {
    protein: {
      current: Math.round(reportData?.weeklyAverage?.protein ?? 0),
      goal: 180,
    },
    carbs: {
      current: Math.round(reportData?.weeklyAverage?.carbs ?? 0),
      goal: 250,
    },
    fats: {
      current: Math.round(reportData?.weeklyAverage?.fat ?? 0),
      goal: 70,
    },
  };

  const microNutrients = {
    sugar: {
      current: Math.round(reportData?.weeklyAverage?.sugar ?? 0),
      goal: 40,
    },
    fiber: {
      current: Math.round(reportData?.weeklyAverage?.fiber ?? 0),
      goal: 30,
    },
    sodium: {
      current: Math.round(reportData?.weeklyAverage?.sodium ?? 0),
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
