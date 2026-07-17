import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Apple, ChevronRight } from 'lucide-react-native';

import { HStack } from '../ui/hstack';
import { VStack } from '../ui/vstack';
import { Divider } from '../ui/divider';
import { Text } from '../ui/text';
import { FoodItem, Meals } from '../../types/types';
import { MealSlotStatus } from '../../utils/mealSlots';
import { FoodMacros, calculateFoodMacros } from '../../utils/foodCalculations';
import MealBreakdown, { MealBreakdownDetails } from './MealBreakdown';

interface MealSlotSectionProps {
  selectedDateLabel: string;
  isPastSelectedDate: boolean;
  canLogFoodForSelectedDate: boolean;
  missingMealLabel: string;
  dailyMacroSummaryItems: { label: string; value: string; green: boolean }[];
  foodLogs: FoodItem[];
  foodTotals: FoodMacros;
  normalizedMeals: Meals;
  loggedMealItems: MealSlotStatus[];
  missingMealItems: MealSlotStatus[];
  expandedMeal: string | null;
  onToggleMeal: (mealKey: string) => void;
  expandedMealDetails: MealBreakdownDetails | null;
  onLogFood: () => void;
}

/** The dashboard's main-body food card: macro summary, logged/missing meal slots, breakdown. */
const MealSlotSection = ({
  selectedDateLabel,
  isPastSelectedDate,
  canLogFoodForSelectedDate,
  missingMealLabel,
  dailyMacroSummaryItems,
  foodLogs,
  foodTotals,
  normalizedMeals,
  loggedMealItems,
  missingMealItems,
  expandedMeal,
  onToggleMeal,
  expandedMealDetails,
  onLogFood,
}: MealSlotSectionProps) => (
  <VStack className="w-full bg-white rounded-2xl p-4 border border-gray-200 gap-3">
    <HStack className="flex items-center gap-2">
      <View className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
        <Apple size={18} stroke="#059669" strokeWidth={2.5} />
      </View>
      <Text size="xl" className="font-semibold text-gray-900">
        Food for {selectedDateLabel}
      </Text>
    </HStack>

    <HStack className="gap-1.5 mb-4">
      {dailyMacroSummaryItems.map(item => (
        <View
          key={item.label}
          className={`flex-1 rounded-xl py-2 px-1 items-center ${
            item.green
              ? 'bg-emerald-50 border border-emerald-100'
              : 'bg-gray-50 border border-gray-100'
          }`}
        >
          <Text className={`text-sm font-semibold ${item.green ? 'text-emerald-600' : 'text-gray-900'}`}>
            {item.value}
          </Text>
          <Text className="text-[10px] text-gray-400 mt-0.5">{item.label}</Text>
        </View>
      ))}
    </HStack>

    {foodLogs.length === 0 ? (
      <View className="rounded-xl bg-gray-50 border border-gray-200 p-4">
        <Text className="text-base font-semibold text-gray-900 mb-1">
          No food logged
        </Text>
        <Text
          className={`text-sm text-gray-600 ${canLogFoodForSelectedDate ? 'mb-3' : ''}`}
        >
          {canLogFoodForSelectedDate
            ? 'Add meals to see calories and macros for this date.'
            : 'Food can only be logged for today or past dates.'}
        </Text>
        {canLogFoodForSelectedDate ? (
          <TouchableOpacity
            onPress={onLogFood}
            className="self-start rounded-lg bg-blue-600 px-4 py-2"
          >
            <Text className="text-white font-semibold">Log Food</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    ) : (
      <>
        <HStack className="justify-between items-center">
          <Text size="2xl" className="font-bold text-gray-900">
            {Math.round(foodTotals.calories).toLocaleString()}
          </Text>
          <Text className="text-gray-600">calories</Text>
        </HStack>

        <Divider className="h-[1px] bg-gray-200" />

        <HStack className="justify-between items-center">
          <VStack>
            <Text className="text-gray-600">Protein</Text>
            <Text className="text-gray-900 font-bold">
              {Math.round(foodTotals.protein)}g
            </Text>
          </VStack>

          <VStack>
            <Text className="text-gray-600">Carbs</Text>
            <Text className="text-gray-900 font-bold">
              {Math.round(foodTotals.carbs)}g
            </Text>
          </VStack>

          <VStack>
            <Text className="text-gray-600">Fats</Text>
            <Text className="text-gray-900 font-bold">
              {Math.round(foodTotals.fat)}g
            </Text>
          </VStack>
        </HStack>
      </>
    )}

    <Divider className="h-[1px] bg-gray-200" />

    <VStack className="gap-2">
      <HStack className="items-center gap-1.5 mb-2">
        <View className="w-[5px] h-[5px] rounded-full bg-emerald-600" />
        <Text className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">
          Logged
        </Text>
      </HStack>

      {loggedMealItems.length === 0 ? (
        <Text className="text-sm text-gray-500">No meals logged for this date.</Text>
      ) : (
        <View className="flex-row flex-wrap gap-2 mb-3">
          {loggedMealItems.map(slot => {
            const mealFoods = normalizedMeals[slot.key] || [];
            const mealMacros = calculateFoodMacros(mealFoods);
            const isExpanded = expandedMeal === slot.key;

            return (
              <TouchableOpacity
                key={`logged-${slot.key}`}
                activeOpacity={0.85}
                onPress={() => onToggleMeal(slot.key)}
                className={`w-[48%] rounded-xl bg-emerald-50 p-3 ${
                  isExpanded
                    ? 'border-[1.5px] border-emerald-500'
                    : 'border border-emerald-100'
                }`}
              >
                <HStack className="justify-between items-center mb-2">
                  <View className="w-[7px] h-[7px] rounded-full bg-emerald-600" />
                  <View className="rounded-full bg-emerald-100 px-2 py-0.5">
                    <Text className="text-[10px] font-medium text-emerald-600">
                      {slot.count} item{slot.count === 1 ? '' : 's'}
                    </Text>
                  </View>
                </HStack>
                <Text className="text-[13px] font-semibold text-gray-900">{slot.label}</Text>

                <HStack className="gap-2 mt-1.5">
                  <Text className="text-[10px] text-gray-500">
                    P <Text className="text-emerald-600 font-medium">{Math.round(mealMacros.protein)}g</Text>
                  </Text>
                  <Text className="text-[10px] text-gray-500">
                    C <Text className="text-emerald-600 font-medium">{Math.round(mealMacros.carbs)}g</Text>
                  </Text>
                  <Text className="text-[10px] text-gray-500">
                    F <Text className="text-emerald-600 font-medium">{Math.round(mealMacros.fat)}g</Text>
                  </Text>
                </HStack>

                <HStack className="items-center gap-1 mt-1.5">
                  <ChevronRight size={9} color="#9ca3af" strokeWidth={2} />
                  <Text className="text-[10px] text-gray-400">
                    {isExpanded ? 'Tap to close' : 'Tap to view'}
                  </Text>
                </HStack>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </VStack>

    {expandedMealDetails ? <MealBreakdown details={expandedMealDetails} /> : null}

    <VStack className="gap-2">
      <HStack className="items-center gap-1.5 mb-2">
        <View className="w-[5px] h-[5px] rounded-full bg-red-300" />
        <Text className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">
          {missingMealLabel}
        </Text>
      </HStack>

      {missingMealItems.length === 0 ? (
        <Text className="text-sm text-gray-500">No missed meals.</Text>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {missingMealItems.map(slot => (
            <View
              key={`missing-${slot.key}`}
              className="w-[48%] rounded-xl bg-gray-50 border border-gray-100 p-3"
            >
              <HStack className="justify-between items-center mb-2">
                <View className="w-[7px] h-[7px] rounded-full border border-red-300" />
              </HStack>
              <Text className="text-[13px] font-semibold text-gray-400">{slot.label}</Text>
              <Text className="text-[10px] font-medium text-rose-400 mt-1">
                {isPastSelectedDate ? 'Missed' : 'Not logged'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </VStack>
  </VStack>
);

export default MealSlotSection;
