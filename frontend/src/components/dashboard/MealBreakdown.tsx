import React from 'react';
import { View } from 'react-native';

import { HStack } from '../ui/hstack';
import { Text } from '../ui/text';
import { FoodItem } from '../../types/types';

export interface MealBreakdownDetails {
  slotLabel?: string;
  mealFoods: FoodItem[];
  macroItems: { label: string; value: string | number }[];
}

interface MealBreakdownProps {
  details: MealBreakdownDetails;
}

/** Expanded per-meal breakdown: macro totals row plus each logged food's macros. */
const MealBreakdown = ({ details }: MealBreakdownProps) => (
  <View className="rounded-2xl border border-emerald-100 overflow-hidden mb-3">
    <View className="bg-emerald-50 px-3.5 py-2.5 border-b border-emerald-100">
      <Text className="text-[13px] font-semibold text-emerald-700">
        {details.slotLabel} breakdown
      </Text>
    </View>

    <HStack className="border-b border-gray-100">
      {details.macroItems.map((m, i, arr) => (
        <View
          key={m.label}
          className={`flex-1 items-center py-2.5 ${i < arr.length - 1 ? 'border-r border-gray-100' : ''}`}
        >
          <Text className="text-sm font-semibold text-gray-900">{m.value}</Text>
          <Text className="text-[10px] text-gray-400 mt-0.5">{m.label}</Text>
        </View>
      ))}
    </HStack>

    {details.mealFoods.map((food, index) => (
      <View
        key={food.id}
        className={`px-3.5 py-2.5 ${index < details.mealFoods.length - 1 ? 'border-b border-gray-100' : ''}`}
      >
        <HStack className="justify-between items-start">
          <Text className="text-[13px] text-gray-900 flex-1 mr-2">{food.name}</Text>
          <Text className="text-[12px] text-gray-400">{Math.round(food.calories || 0)} cal</Text>
        </HStack>
        <HStack className="gap-3 mt-1">
          <Text className="text-[10px] text-gray-400">
            P <Text className="text-gray-600 font-medium">{Math.round(food.protein || 0)}g</Text>
          </Text>
          <Text className="text-[10px] text-gray-400">
            C <Text className="text-gray-600 font-medium">{Math.round(food.carbs || 0)}g</Text>
          </Text>
          <Text className="text-[10px] text-gray-400">
            F <Text className="text-gray-600 font-medium">{Math.round(food.fat || 0)}g</Text>
          </Text>
        </HStack>
      </View>
    ))}
  </View>
);

export default MealBreakdown;
