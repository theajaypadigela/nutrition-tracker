import React, { useCallback } from 'react';
import { Text } from '../../components/ui/text';
import { VStack } from '../../components/ui/vstack';
import { MealGroup } from '../../components/food-log/MealGroup';
import { EditFoodDrawer } from '../../components/food-log/EditFoodDrawer';
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
import {
  useNavigation,
  useFocusEffect,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Plus, Mic, Clock } from 'lucide-react-native';
import { getTodayLocalDate } from '../../utils/date';
import { formatEpochTime12h } from '../../utils/timeFormatter';
import { useFoodLog } from '../../hooks/useFoodLog';
import { FoodStackParamList } from '../../navigation/FoodStackNavigator';
import { navigateToVoiceMealLog } from '../../navigation/navigationUtils';
import MealReminderSettings from '../../components/food-log/MealReminderSettings';

type FoodLogNavigationProp = StackNavigationProp<
  FoodStackParamList,
  'FoodLog'
>;

type FoodLogRouteProp = RouteProp<FoodStackParamList, 'FoodLog'>;

const FoodLogScreen = () => {
  const navigation = useNavigation<FoodLogNavigationProp>();
  const route = useRoute<FoodLogRouteProp>();

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

  const {
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
  } = useFoodLog(selectedDate);

  // Reload on focus (e.g., after returning from VoiceMealLogScreen).
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

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
                Meal logging call rescheduled for{' '}
                <Text className="font-bold text-amber-800">
                  {formatEpochTime12h(mealRescheduleTime)}
                </Text>
              </Text>
            </View>
          )}
          {/* Manage the daily meal-logging reminder right here, where meals are logged. */}
          <MealReminderSettings variant="card" />
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
                onToggleExpand={() => toggleMeal(mealType)}
                onEdit={openEditor}
                onDelete={deleteFood}
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
          onClose={closeEditor}
          onSave={saveFood}
          initialData={selectedFood}
        />
      </ScrollView>

      {/* Voice Log Button — routes to the root-stack VoiceMealLog (single registration). */}
      <TouchableOpacity
        onPress={() => navigateToVoiceMealLog({ selectedDate })}
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
