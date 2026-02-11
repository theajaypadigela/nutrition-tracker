import React from 'react';
import { View } from 'react-native';
import { HStack } from '../ui/hstack';
import { VStack } from '../ui/vstack';
import { Text } from '../ui/text';

interface CaloriesSummaryCardProps {
  weeklyAvgCalories: number;
  dailyCalorieGoal: number;
}

const CaloriesSummaryCard: React.FC<CaloriesSummaryCardProps> = ({
  weeklyAvgCalories,
  dailyCalorieGoal,
}) => {
  const percentage = Math.round((weeklyAvgCalories / dailyCalorieGoal) * 100);

  return (
    <VStack className="bg-emerald-600 rounded-2xl p-6 gap-3">
      <Text
        size="sm"
        className="text-white opacity-90 font-medium uppercase tracking-wide"
      >
        Weekly Average
      </Text>
      <HStack className="items-end gap-2">
        <Text className="text-5xl font-bold text-white">
          {weeklyAvgCalories.toLocaleString()}
        </Text>
        <Text className="text-2xl text-white opacity-80 mb-2">kcal</Text>
      </HStack>
      <HStack className="items-center gap-2">
        <View className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
          <View
            className="h-full bg-white rounded-full"
            style={{
              width: `${percentage}%`,
            }}
          />
        </View>
        <Text className="text-white text-sm">{percentage}% of goal</Text>
      </HStack>
    </VStack>
  );
};

export default CaloriesSummaryCard;
