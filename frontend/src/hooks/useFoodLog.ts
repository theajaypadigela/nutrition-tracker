import { useCallback, useState } from 'react';
import { FoodItem, Meals, MealsResponse, NutritionTotals } from '../types/types';
import { foodLogApi } from '../services/api/foodLogApi';
import { getMealRescheduleFireAt } from '../services/notifications/reminderService';
import { createEmptyMeals, normalizeMeals } from '../utils/meals';

const EMPTY_TOTALS: NutritionTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  sodium: 0,
};

/**
 * Controller for a day's food log: fetch, the meal-reschedule banner, the edit-drawer
 * state, and entry save/delete (all via foodLogApi). Replaces the previous two-sources-of-
 * truth pattern (fetched data synced into local state) with a single owned state.
 */
export function useFoodLog(selectedDate: string) {
  const [meals, setMeals] = useState<Meals>(createEmptyMeals());
  const [nutritionTotals, setNutritionTotals] =
    useState<NutritionTotals>(EMPTY_TOTALS);
  const [refreshing, setRefreshing] = useState(false);
  const [mealRescheduleTime, setMealRescheduleTime] = useState<number | null>(
    null,
  );
  const [expandedMeal, setExpandedMeal] = useState<string | null>('breakfast');
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);

  const applyResponse = useCallback((res?: Partial<MealsResponse> | null) => {
    if (res?.meals) setMeals(normalizeMeals(res.meals));
    if (res?.totals) setNutritionTotals(res.totals);
  }, []);

  const loadFoodLog = useCallback(async () => {
    try {
      const res = await foodLogApi.getLog(selectedDate);
      applyResponse(res);
    } catch (error) {
      console.error('Failed to load food log:', error);
    }
  }, [selectedDate, applyResponse]);

  // Fetch the log + the meal-reschedule banner time together (used on focus + refresh).
  const reload = useCallback(async () => {
    await loadFoodLog();
    const ts = await getMealRescheduleFireAt();
    setMealRescheduleTime(ts);
  }, [loadFoodLog]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const toggleMeal = useCallback((mealType: string) => {
    setExpandedMeal(prev => (prev === mealType ? null : mealType));
  }, []);

  const openEditor = useCallback((item: FoodItem) => {
    setSelectedFood(item);
    setShowDrawer(true);
  }, []);

  const closeEditor = useCallback(() => {
    setShowDrawer(false);
    setSelectedFood(null);
  }, []);

  const saveFood = useCallback(
    async (name: string, quantity: string, servingSize: string) => {
      if (!selectedFood) return;
      try {
        const res = await foodLogApi.updateEntry(selectedDate, selectedFood.id, {
          name,
          quantity: parseFloat(quantity),
          unit: servingSize,
        });
        applyResponse(res);
      } catch (err) {
        console.error('Error saving food:', err);
        throw err;
      }
    },
    [selectedDate, selectedFood, applyResponse],
  );

  const deleteFood = useCallback(
    async (_mealType: string, itemId: string) => {
      try {
        const res = await foodLogApi.deleteEntry(itemId);
        applyResponse(res);
      } catch (err) {
        console.error('Error deleting food:', err);
      }
    },
    [applyResponse],
  );

  return {
    meals,
    nutritionTotals,
    refreshing,
    mealRescheduleTime,
    expandedMeal,
    toggleMeal,
    showDrawer,
    selectedFood,
    openEditor,
    closeEditor,
    reload,
    handleRefresh,
    saveFood,
    deleteFood,
  };
}
