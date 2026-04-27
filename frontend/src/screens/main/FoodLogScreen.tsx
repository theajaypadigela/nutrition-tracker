import React, { useState, useEffect, useCallback } from 'react';
import { Text } from '../../components/ui/text';
import { VStack } from '../../components/ui/vstack';
import { MealGroup } from '../../components/food-log/MealGroup';
import { EditFoodDrawer } from '../../components/food-log/EditFoodDrawer';
import {
  FoodItem,
  Meals,
  MealsResponse,
  NutritionTotals,
} from '../../types/types';
import {
  ScrollView,
  View,
  TouchableOpacity,
  Platform,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import AppBar from '../../components/AppBar';
import useApi from '../../hooks/useApi';
import NutritionDisplay from '../../components/food-log/NutritionDisplay';
import {
  useNavigation,
  useFocusEffect,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Plus, Mic, Clock } from 'lucide-react-native';
import { loadMealRescheduleTime } from '../../services/mealScheduler';
import { getTodayLocalDate } from '../../utils/date';
import { createEmptyMeals, normalizeMeals } from '../../utils/meals';
import { FoodStackParamList } from '../../navigation/FoodStackNavigator';

type FoodLogNavigationProp = StackNavigationProp<
  FoodStackParamList,
  'FoodLog'
>;

type FoodLogRouteProp = RouteProp<FoodStackParamList, 'FoodLog'>;

function formatTime(ts: number): string {
  const d = new Date(ts);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const mm = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours}:${mm} ${ampm}`;
}

const FoodLogScreen = () => {
  const navigation = useNavigation<FoodLogNavigationProp>();
  const route = useRoute<FoodLogRouteProp>();
  const [expandedMeal, setExpandedMeal] = useState<string | null>('breakfast');
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);

  const { data, request } = useApi<MealsResponse>();

  const selectedDate = React.useMemo(() => {
    const todayKey = getTodayLocalDate();
    const requestedDate = route.params?.selectedDate;

    if (
      typeof requestedDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ) {
      return todayKey;
    }

    return requestedDate > todayKey ? todayKey : requestedDate;
  }, [route.params?.selectedDate]);

  const [refreshing, setRefreshing] = useState(false);
  const [mealRescheduleTime, setMealRescheduleTime] = useState<number | null>(null);

  const [meals, setMeals] = useState<Meals>(createEmptyMeals());

  const [nutritionTotals, setNutritionTotals] = useState<NutritionTotals>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
  });

  const loadFoodLog = useCallback(async () => {
    try {
      await request({
        url: `/food/${selectedDate}`,
        method: 'GET',
      });
    } catch (error) {
      console.error('Failed to load food log:', error);
    }
  }, [selectedDate, request]);

  // Reload data when the screen gains focus (e.g., after returning from VoiceMealLogScreen)
  useFocusEffect(
    useCallback(() => {
      loadFoodLog();
      loadMealRescheduleTime().then(ts => setMealRescheduleTime(ts));
    }, [loadFoodLog]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFoodLog();
    const ts = await loadMealRescheduleTime();
    setMealRescheduleTime(ts);
    setRefreshing(false);
  };

  useEffect(() => {
    if (data?.meals) {
      setMeals(normalizeMeals(data.meals));
    }
    if (data?.totals) {
      setNutritionTotals(data.totals);
    }
  }, [data]);

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
      const response = await request({
        url: `/food/${selectedDate}/meals/entries/${selectedFood.id}`,
        method: 'PUT',
        data: {
          name,
          quantity: parseFloat(quantity),
          unit: servingSize,
        },
      });

      if (response?.meals) {
        setMeals(normalizeMeals(response.meals));
      }
      if (response?.totals) {
        setNutritionTotals(response.totals);
      }
    } catch (err) {
      console.error('Error saving food:', err);
      throw err;
    }
  };

  const handleDeleteFood = async (_mealType: string, itemId: string) => {
    try {
      const response = await request({
        url: `/food/meals/entries/${itemId}`,
        method: 'DELETE',
      });

      if (response?.meals) {
        setMeals(normalizeMeals(response.meals));
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
      <AppBar title="Food Log" showProfileShortcut />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <VStack className="w-full p-6">
          {Boolean(mealRescheduleTime) && (
            <View className="flex-row items-center bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 gap-2">
              <Clock size={16} color="#D97706" />
              <Text className="text-amber-700 text-sm flex-1">
                Meal logging call rescheduled for today at{' '}
                <Text className="font-bold text-amber-800">
                  {formatTime(mealRescheduleTime)}
                </Text>
              </Text>
            </View>
          )}
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
        onPress={() => navigation.navigate('VoiceMealLog', { selectedDate })}
        style={styles.voiceFab}
        activeOpacity={0.8}
      >
        <Mic size={24} stroke="white" strokeWidth={2.5} />
      </TouchableOpacity>

      {/* Floating Action Button */}
      <TouchableOpacity
        onPress={() => navigation.navigate('ManualFoodLog', { selectedDate })}
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
