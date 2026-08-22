import React, { useState, useCallback } from 'react';
import { Text } from '../../components/ui/text';
import { VStack } from '../../components/ui/vstack';
import { MealGroup } from '../../components/food-log/MealGroup';
import { EditFoodDrawer } from '../../components/food-log/EditFoodDrawer';
import { FoodItem, Meals, NutritionTotals } from '../../types/types';
import {
  ScrollView,
  View,
  TouchableOpacity,
  Platform,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import AppBar from '../../components/AppBar';
import NutritionDisplay from '../../components/food-log/NutritionDisplay';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Plus, Mic } from 'lucide-react-native';
import { formatLocalDate } from '../../shared/date-time/localDate';
import { foodLogApi } from '../../features/food-log/api/foodLogApi';
import { useApiOperation } from '../../features/api/useApiOperation';

// Use a local type to avoid a circular import with FoodStackNavigator
type FoodLogNavigationProp = StackNavigationProp<
  { FoodLog: undefined; ManualFoodLog: undefined; VoiceMealLog: undefined },
  'FoodLog'
>;

const FoodLogScreen = () => {
  const navigation = useNavigation<FoodLogNavigationProp>();
  const [expandedMeal, setExpandedMeal] = useState<string | null>('breakfast');
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const { execute: executeFoodRequest } = useApiOperation();

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => formatLocalDate();

  const [selectedDate] = useState(getTodayDate());
  const [refreshing, setRefreshing] = useState(false);

  const [meals, setMeals] = useState<Meals>({
    breakfast: [],
    lunch: [],
    snack: [],
    dinner: [],
  });

  const [nutritionTotals, setNutritionTotals] = useState<NutritionTotals>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
  });

  const foodItems = Object.values(meals).flat();
  const hasPendingNutrition = foodItems.some(
    item =>
      item.enrichmentStatus === 'pending' ||
      item.enrichmentStatus === 'in_progress',
  );
  const hasFailedNutrition = foodItems.some(
    item => item.enrichmentStatus === 'failed',
  );

  const loadFoodLog = useCallback(async () => {
    try {
      const response = await executeFoodRequest(signal =>
        foodLogApi.getForDate(selectedDate, { signal }),
      );
      if (response.meals) {
        setMeals(response.meals);
        console.log(
          'Fetched meals:',
          response.meals,
          'for date:',
          selectedDate,
        );
      }
      if (response.totals) {
        setNutritionTotals(response.totals);
        console.log('Nutrition totals:', response.totals);
      }
    } catch (error) {
      console.error('Failed to load food log:', error);
    }
  }, [executeFoodRequest, selectedDate]);

  // Reload data when the screen gains focus (e.g., after returning from VoiceMealLogScreen)
  useFocusEffect(
    useCallback(() => {
      loadFoodLog();
    }, [loadFoodLog]),
  );

  React.useEffect(() => {
    loadFoodLog();
  }, [loadFoodLog]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFoodLog();
    setRefreshing(false);
  };

  const handleEditFood = async (item: FoodItem) => {
    setSelectedFood(item);
    setShowDrawer(true);
  };

  const handleSaveFood = async (
    name: string,
    quantity: string,
    servingSize: string,
  ) => {
    if (!selectedFood) return;

    try {
      const response = await executeFoodRequest(signal =>
        foodLogApi.updateEntry(
          selectedDate,
          selectedFood.id,
          {
            name,
            quantity: parseFloat(quantity),
            unit: servingSize,
          },
          { signal },
        ),
      );

      // Refresh data from backend response
      if (response?.meals) {
        setMeals(response.meals);
      }
      if (response?.totals) {
        setNutritionTotals(response.totals);
      }

      setShowDrawer(false);
      setSelectedFood(null);
    } catch (err) {
      console.error('Error saving food:', err);
    }
  };

  const handleDeleteFood = async (mealType: string, itemId: string) => {
    try {
      const response = await executeFoodRequest(signal =>
        foodLogApi.deleteEntry(selectedDate, itemId, { signal }),
      );

      // Refresh data from backend response
      if (response?.meals) {
        setMeals(response.meals);
      }
      if (response?.totals) {
        setNutritionTotals(response.totals);
      }
    } catch (err) {
      console.error('Error deleting food:', err);
    }
  };

  return (
    <View className="flex-1">
      <AppBar title="Food Log" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <VStack className="w-full p-6">
          <VStack>
            <Text size="md" className="font-bold text-gray-500">
              MEAL BREAKDOWN
            </Text>
            {Object.entries(meals).map(([mealType, items]) => (
              <MealGroup
                key={mealType}
                mealType={mealType}
                items={items}
                isExpanded={expandedMeal === mealType}
                onToggleExpand={() =>
                  setExpandedMeal(expandedMeal === mealType ? null : mealType)
                }
                onEdit={handleEditFood}
                onDelete={handleDeleteFood}
              />
            ))}
          </VStack>
          {hasPendingNutrition ? (
            <VStack className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <Text className="font-semibold text-amber-800">
                Estimating nutrition totals…
              </Text>
              <Text size="sm" className="mt-1 text-amber-700">
                Totals will appear when every pending item has been estimated.
              </Text>
            </VStack>
          ) : (
            <NutritionDisplay
              calories={nutritionTotals.calories}
              targetCalories={2500}
              totals={{
                protein: nutritionTotals.protein,
                carbs: nutritionTotals.carbs,
                fat: nutritionTotals.fat,
                sugar: nutritionTotals.sugar,
              }}
              dailyGoals={{
                protein: 180,
                carbs: 250,
                fat: 70,
                sugar: 40,
              }}
            />
          )}
          {hasFailedNutrition && (
            <VStack className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <Text className="font-medium text-red-700">
                Some items couldn’t be estimated. Totals exclude those items.
              </Text>
            </VStack>
          )}
        </VStack>
        <EditFoodDrawer
          isOpen={showDrawer}
          onClose={() => {
            setShowDrawer(false);
            setSelectedFood(null);
          }}
          onSave={handleSaveFood}
          initialData={selectedFood}
        />
      </ScrollView>

      {/* Voice Log Button */}
      <TouchableOpacity
        onPress={() => navigation.navigate('VoiceMealLog')}
        style={styles.voiceFab}
        activeOpacity={0.8}
      >
        <Mic size={24} stroke="white" strokeWidth={2.5} />
      </TouchableOpacity>

      {/* Floating Action Button */}
      <TouchableOpacity
        onPress={() => navigation.navigate('ManualFoodLog')}
        style={styles.fab}
        activeOpacity={0.8}
      >
        <Plus size={28} stroke="white" strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  voiceFab: {
    position: 'absolute',
    right: 20,
    bottom: Platform.OS === 'ios' ? 180 : 170,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: Platform.OS === 'ios' ? 110 : 100,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default FoodLogScreen;
