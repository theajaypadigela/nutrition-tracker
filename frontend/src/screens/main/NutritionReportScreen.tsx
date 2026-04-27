import {
  View,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { VStack } from '../../components/ui/vstack';
import { HStack } from '../../components/ui/hstack';
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import CaloriesSummaryCard from '../../components/nutrition-report/CaloriesSummaryCard';
import MacroNutrientsSection from '../../components/nutrition-report/MacroNutrientsSection';
import MicroNutrientsSection from '../../components/nutrition-report/MicroNutrientsSection';
import {
  Lightbulb,
  RefreshCw,
  ChevronRight,
  BarChart3,
} from 'lucide-react-native';
import { Text } from '../../components/ui/text';
import InsightsBadge from '../../components/nutrition-report/InsightsBadge';
import {
  Insight,
  AllNutrientSummary,
} from '../../components/nutrition-report/types';
import AppBar from '../../components/AppBar';
import useApi from '../../hooks/useApi';
import { WeeklyNutritionReport } from '../../types/types';
import { formatLocalDate } from '../../utils/date';

interface InsightApiResponse {
  variant: 'positive' | 'negative' | 'neutral';
  message: string;
}

const DAYS_IN_WEEK = 7;
const DAILY_GOALS = {
  calories: 2500,
  protein: 180,
  carbs: 250,
  fat: 70,
  sugar: 40,
  fiber: 30,
  sodium: 2300,
};

const getCurrentSundayToSaturdayRange = () => {
  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(today.getDate() - today.getDay());

  const end = new Date(start);
  end.setDate(start.getDate() + DAYS_IN_WEEK - 1);

  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
    daysElapsed: today.getDay() + 1,
  };
};

const NutritionReportScreen = () => {
  const navigation = useNavigation();
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

  const loadWeeklyReport = useCallback(async () => {
    try {
      const { startDate, endDate } = getCurrentSundayToSaturdayRange();
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
      const { startDate, endDate } = getCurrentSundayToSaturdayRange();
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
    const loadReportData = async () => {
      await Promise.all([loadWeeklyReport(), loadNutrientSummaries()]);
    };

    loadReportData();
    const unsubscribe = navigation.addListener('focus', loadReportData);

    return unsubscribe;
  }, [navigation, loadWeeklyReport, loadNutrientSummaries]);

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

  const hasNutritionData = useCallback((report: WeeklyNutritionReport | null) => {
    if (!report?.weeklyTotals) {
      return false;
    }

    const { calories, protein, carbs, fat, fiber, sugar, sodium } =
      report.weeklyTotals;

    return [calories, protein, carbs, fat, fiber, sugar, sodium].some(
      value => (value ?? 0) > 0,
    );
  }, []);

  // Fetch AI Insights
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
      const { startDate, endDate } = getCurrentSundayToSaturdayRange();
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
  }, [insightsRequest, reportData, generateFallbackInsights, hasNutritionData]);

  useEffect(() => {
    if (hasNutritionData(reportData)) {
      fetchAiInsights();
      return;
    }

    setAiInsights([]);
    setInsightsError(null);
    setUsingFallback(false);
    setInsightsLoading(false);
  }, [reportData, fetchAiInsights, hasNutritionData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadWeeklyReport(), loadNutrientSummaries()]);
    setRefreshing(false);
  }, [loadWeeklyReport, loadNutrientSummaries]);

  const canShowInsights = hasNutritionData(reportData);
  const emptyStateInsight: Insight = {
    variant: 'neutral',
    message: 'Log your meals to get personalized insights.',
  };
  const displayInsights = canShowInsights
    ? aiInsights.length > 0
      ? aiInsights
      : generateFallbackInsights()
    : [emptyStateInsight];

  const { daysElapsed } = getCurrentSundayToSaturdayRange();

  const getSummaryTotal = useCallback(
    (id: string): number => {
      const nutrient = allNutrients.find(n => n.id === id);
      if (!nutrient) {
        return 0;
      }
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

  // Use real data if available, otherwise show defaults
  const caloriesSoFar = preferNonZero(
    Math.round(reportData?.weeklyTotals?.calories ?? 0),
    Math.round(getSummaryTotal('calories')),
  );
  const dailyCalorieGoal = DAILY_GOALS.calories;
  const proratedCalorieGoal = dailyCalorieGoal * daysElapsed;
  const weeklyCalorieGoal = dailyCalorieGoal * DAYS_IN_WEEK;

  const proteinCurrent = preferNonZero(
    Math.round(reportData?.weeklyTotals?.protein ?? 0),
    Math.round(getSummaryTotal('protein')),
  );
  const carbsCurrent = preferNonZero(
    Math.round(reportData?.weeklyTotals?.carbs ?? 0),
    Math.round(getSummaryTotal('carbs')),
  );
  const fatCurrent = preferNonZero(
    Math.round(reportData?.weeklyTotals?.fat ?? 0),
    Math.round(getSummaryTotal('fat')),
  );
  const sugarCurrent = preferNonZero(
    Math.round(reportData?.weeklyTotals?.sugar ?? 0),
    Math.round(getSummaryTotal('sugar')),
  );
  const fiberCurrent = preferNonZero(
    Math.round(reportData?.weeklyTotals?.fiber ?? 0),
    Math.round(getSummaryTotal('fiber')),
  );
  const sodiumCurrent = preferNonZero(
    Math.round(reportData?.weeklyTotals?.sodium ?? 0),
    Math.round(getSummaryTotal('sodium')),
  );

  const macroNutrients = {
    protein: {
      current: proteinCurrent,
      goal: DAILY_GOALS.protein * daysElapsed,
      weeklyGoal: DAILY_GOALS.protein * DAYS_IN_WEEK,
    },
    carbs: {
      current: carbsCurrent,
      goal: DAILY_GOALS.carbs * daysElapsed,
      weeklyGoal: DAILY_GOALS.carbs * DAYS_IN_WEEK,
    },
    fats: {
      current: fatCurrent,
      goal: DAILY_GOALS.fat * daysElapsed,
      weeklyGoal: DAILY_GOALS.fat * DAYS_IN_WEEK,
    },
  };

  const microNutrients = {
    sugar: {
      current: sugarCurrent,
      goal: DAILY_GOALS.sugar * daysElapsed,
      weeklyGoal: DAILY_GOALS.sugar * DAYS_IN_WEEK,
    },
    fiber: {
      current: fiberCurrent,
      goal: DAILY_GOALS.fiber * daysElapsed,
      weeklyGoal: DAILY_GOALS.fiber * DAYS_IN_WEEK,
    },
    sodium: {
      current: sodiumCurrent,
      goal: DAILY_GOALS.sodium * daysElapsed,
      weeklyGoal: DAILY_GOALS.sodium * DAYS_IN_WEEK,
    },
  };

  const handleOpenWeeklySummary = () => {
    navigation.navigate('WeeklyNutritionSummary' as never);
  };

  return (
    <View className="flex-1">
      <AppBar title="Nutrition Report" showProfileShortcut />
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0284c7" />
          <Text className="mt-4 text-gray-600">Loading nutrition data...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
          contentContainerStyle={styles.scrollContent}
        >
          <VStack className="p-6 gap-6">
            <CaloriesSummaryCard
              caloriesSoFar={caloriesSoFar}
              proratedGoal={proratedCalorieGoal}
              weeklyGoal={weeklyCalorieGoal}
              daysElapsed={daysElapsed}
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
              {!insightsLoading && reportData && canShowInsights && (
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

          {/* Navigation card → All-nutrients weekly summary */}
          <TouchableOpacity
            onPress={handleOpenWeeklySummary}
            activeOpacity={0.85}
            style={styles.navCard}
          >
            <View style={styles.navIconWrap}>
              <BarChart3 size={20} color="#0a3a82" strokeWidth={2.2} />
            </View>
            <View style={styles.navTextCol}>
              <Text style={styles.navTitle}>All nutrients · weekly view</Text>
              <Text style={styles.navSub}>
                Score, search, day-by-day chart, custom goals
              </Text>
            </View>
            <ChevronRight size={20} color="#0a3a82" strokeWidth={2.2} />
          </TouchableOpacity>

          <View style={styles.listFooter} />
        </ScrollView>
      )}
    </View>
  );
};

export default NutritionReportScreen;

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 0,
  },
  listFooter: {
    height: 120,
  },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginTop: 0,
    marginBottom: 4,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#cfdcef',
    backgroundColor: '#eaf2fc',
    gap: 14,
  },
  navIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cfdcef',
  },
  navTextCol: {
    flex: 1,
  },
  navTitle: {
    color: '#0a3a82',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  navSub: {
    color: '#3f5b86',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
});
