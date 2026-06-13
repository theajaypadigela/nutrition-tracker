import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardResponse, FoodItem, Habit } from '../types/types';
import { dashboardApi } from '../services/api/dashboardApi';
import { getTodayLocalDate } from '../utils/date';
import { normalizeMeals } from '../utils/meals';
import { MEAL_SLOTS, buildMealSlotStatus } from '../utils/mealSlots';
import { calculateFoodMacros } from '../utils/foodCalculations';
import { calculateHabitStats } from '../utils/habitStats';

const EMPTY_HABITS: Habit[] = [];
const EMPTY_FOOD_TOTALS = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
} as const;

/**
 * Owns the dashboard's data + all derivations for a selected date: fetching, meal
 * normalization, habit splits, macro totals, and meal-slot status. DashBoardScreen consumes
 * this and keeps only calendar/date presentation.
 */
export function useDashboard() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayLocalDate);
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);

  const toggleMeal = useCallback((mealKey: string) => {
    setExpandedMeal(prev => (prev === mealKey ? null : mealKey));
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const data = await dashboardApi.getByDate(selectedDate);
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (selectedDate) fetchDashboard();
  }, [selectedDate, fetchDashboard]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  }, [fetchDashboard]);

  const normalizedMeals = useMemo(
    () => normalizeMeals(dashboardData?.foodSummary?.meals),
    [dashboardData],
  );

  const foodLogs: FoodItem[] = useMemo(
    () => Object.values(normalizedMeals).flat(),
    [normalizedMeals],
  );

  const habits: Habit[] = dashboardData?.habits ?? EMPTY_HABITS;
  const { completedCount: completedHabits, totalCount: totalHabits } =
    calculateHabitStats(habits);
  const habitProgress = totalHabits > 0 ? completedHabits / totalHabits : 0;
  const completedHabitItems = useMemo(
    () => habits.filter(h => h.completed),
    [habits],
  );
  const incompleteHabitItems = useMemo(
    () => habits.filter(h => !h.completed),
    [habits],
  );

  const foodTotals = dashboardData?.foodSummary?.totals ?? EMPTY_FOOD_TOTALS;
  const dailyMacroSummaryItems = useMemo(
    () => [
      { label: 'Calories', value: `${Math.round(foodTotals.calories)}`, green: true },
      { label: 'Protein', value: `${Math.round(foodTotals.protein)}g`, green: false },
      { label: 'Carbs', value: `${Math.round(foodTotals.carbs)}g`, green: false },
      { label: 'Fats', value: `${Math.round(foodTotals.fat)}g`, green: false },
    ],
    [foodTotals],
  );

  const mealStatusItems = useMemo(
    () => buildMealSlotStatus(normalizedMeals),
    [normalizedMeals],
  );
  const loggedMealItems = useMemo(
    () => mealStatusItems.filter(slot => slot.logged),
    [mealStatusItems],
  );
  const missingMealItems = useMemo(
    () => mealStatusItems.filter(slot => !slot.logged),
    [mealStatusItems],
  );

  const expandedMealDetails = useMemo(() => {
    if (!expandedMeal) return null;

    const mealFoods = normalizedMeals[expandedMeal] || [];
    const slot = MEAL_SLOTS.find(s => s.key === expandedMeal);
    const totals = calculateFoodMacros(mealFoods);

    return {
      slotLabel: slot?.label,
      mealFoods,
      macroItems: [
        { label: 'cal', value: Math.round(totals.calories) },
        { label: 'protein', value: `${Math.round(totals.protein)}g` },
        { label: 'carbs', value: `${Math.round(totals.carbs)}g` },
        { label: 'fats', value: `${Math.round(totals.fat)}g` },
      ],
    };
  }, [expandedMeal, normalizedMeals]);

  return {
    selectedDate,
    setSelectedDate,
    refreshing,
    handleRefresh,
    fetchDashboard,
    expandedMeal,
    toggleMeal,
    normalizedMeals,
    foodLogs,
    habits,
    completedHabits,
    totalHabits,
    habitProgress,
    completedHabitItems,
    incompleteHabitItems,
    foodTotals,
    dailyMacroSummaryItems,
    loggedMealItems,
    missingMealItems,
    expandedMealDetails,
  };
}
