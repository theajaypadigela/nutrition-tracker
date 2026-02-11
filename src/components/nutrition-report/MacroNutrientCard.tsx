import React from 'react';
import { View } from 'react-native';
import { HStack } from '../ui/hstack';
import { VStack } from '../ui/vstack';
import { Text } from '../ui/text';
import { MacroNutrient } from './types';

interface MacroNutrientCardProps {
  macro: MacroNutrient;
}

const MacroNutrientCard: React.FC<MacroNutrientCardProps> = ({ macro }) => {
  const percentage = Math.round((macro.current / macro.goal) * 100);

  return (
    <VStack
      className={`flex-1 ${macro.bgColor} rounded-2xl p-4 gap-2 border ${macro.borderColor}`}
    >
      {macro.icon}
      <VStack className="gap-1">
        <Text className={`text-xs ${macro.textColor} font-medium uppercase`}>
          {macro.label}
        </Text>
        <HStack className="items-end gap-1">
          <Text
            className={`text-2xl font-bold ${macro.textColor.replace('text-', 'text-')}-900`}
          >
            {macro.current}
          </Text>
          <Text className={`text-sm ${macro.textColor} mb-1`}>
            {macro.unit}
          </Text>
        </HStack>
      </VStack>
      {/* Mini Progress Bar */}
      <View
        className={`w-full h-1.5 ${macro.progressBgColor} rounded-full overflow-hidden`}
      >
        <View
          className={`h-full ${macro.progressColor} rounded-full`}
          style={{
            width: `${percentage}%`,
          }}
        />
      </View>
      <Text className={`text-xs ${macro.textColor}`}>
        {percentage}% of {macro.goal}
        {macro.unit}
      </Text>
    </VStack>
  );
};

export default MacroNutrientCard;
