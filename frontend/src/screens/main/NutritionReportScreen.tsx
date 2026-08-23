import {
  View,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { tokens } from '@/theme/tokens';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import CaloriesSummaryCard from '@/components/nutrition-report/CaloriesSummaryCard';
import MacroNutrientsSection from '@/components/nutrition-report/MacroNutrientsSection';
import MicroNutrientsSection from '@/components/nutrition-report/MicroNutrientsSection';
import {
  Lightbulb,
  RefreshCw,
  ChevronRight,
  BarChart3,
} from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import InsightsBadge from '@/components/nutrition-report/InsightsBadge';
import AppBar from '@/components/common/AppBar';
import { useWeeklyNutritionReport } from '@/hooks/useWeeklyNutritionReport';

const NutritionReportScreen = () => {
  const navigation = useNavigation();
  const {
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
  } = useWeeklyNutritionReport();

  useEffect(() => {
    reload();
    const unsubscribe = navigation.addListener('focus', reload);
    return unsubscribe;
  }, [navigation, reload]);

  const handleOpenWeeklySummary = () => {
    navigation.navigate('WeeklyNutritionSummary' as never);
  };

  return (
    <View className="flex-1">
      <AppBar title="Nutrition Report" showProfileShortcut />
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={tokens.report.spinner} />
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
                <Lightbulb size={20} color={tokens.report.insightIcon} />
                <Text size="md" className="font-bold">
                  {usingFallback ? 'Smart Insights' : 'AI Insights'}
                </Text>
                {insightsLoading && (
                  <ActivityIndicator size="small" color={tokens.report.insightIcon} />
                )}
              </HStack>
              {!insightsLoading && reportData && canShowInsights && (
                <TouchableOpacity onPress={fetchAiInsights} className="p-2">
                  <RefreshCw size={18} color={tokens.report.insightIcon} />
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
              <BarChart3 size={20} color={tokens.report.primaryDeep} strokeWidth={2.2} />
            </View>
            <View style={styles.navTextCol}>
              <Text style={styles.navTitle}>All nutrients · weekly view</Text>
              <Text style={styles.navSub}>
                Score, search, day-by-day chart, custom goals
              </Text>
            </View>
            <ChevronRight size={20} color={tokens.report.primaryDeep} strokeWidth={2.2} />
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
    borderColor: tokens.report.cardLine,
    backgroundColor: tokens.report.cardBg,
    gap: 14,
  },
  navIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: tokens.report.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.report.cardLine,
  },
  navTextCol: {
    flex: 1,
  },
  navTitle: {
    color: tokens.report.primaryDeep,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  navSub: {
    color: tokens.report.inkFaint,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
});
