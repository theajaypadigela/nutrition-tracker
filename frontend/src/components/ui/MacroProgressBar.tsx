import React, { useMemo } from 'react';
import { View } from 'react-native';
import { VStack } from './vstack';
import { Text } from './text';
import { HStack } from './hstack';
import { Badge, BadgeText } from './badge';

interface MacroProgressBarProps {
  goal: number;
  current: number;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  label?: string;
  icon?: React.ReactNode;
  unit?: string;
  is_healthy?: boolean;
}

const colors = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
};

const getProgressTheme = (
  current: number,
  goal: number,
  is_healthy: boolean,
) => {
  const percentage = (current / goal) * 100;

  if (is_healthy) {
    // Logic for "Good" things (Protein, Fiber, Vitamins)
    // Higher is better; going over is usually fine.
    if (percentage >= 100) return colors.blue; // Goal reached/exceeded
    if (percentage >= 80) return colors.green;
    if (percentage >= 40) return colors.yellow;
    return colors.red; // Low is bad
  } else {
    // Logic for "Bad" things (Sugar, Sodium, Saturated Fat)
    // Lower is better; going over is bad.
    if (percentage > 100) return colors.red; // Over limit
    if (percentage >= 80) return colors.yellow; // Approaching limit
    return colors.green; // Low is good
  }
};

const MacroProgressBar = (props: MacroProgressBarProps) => {
  const {
    goal,
    current,
    is_healthy = false,
    size: propsSize,
    icon,
    label,
    unit,
  } = props;

  const size = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
    xl: 'h-4',
    '2xl': 'h-5',
  };

  const badgeStatus = useMemo(() => {
    const percentage = (current / goal) * 100;

    if (is_healthy) {
      // Logic for Protein / Nutrients (High = Good)
      if (percentage > 100)
        return { label: 'Exceed', action: 'success' as const };
      if (percentage >= 80)
        return { label: 'Normal', action: 'success' as const };
      if (percentage >= 40)
        return { label: 'Moderate', action: 'warning' as const };
      return { label: 'Low', action: 'error' as const };
    } else {
      // Logic for Sugar / Fats (Low = Good)
      if (percentage > 100)
        return { label: 'Over Limit', action: 'error' as const };
      if (percentage >= 80)
        return { label: 'High', action: 'warning' as const };
      if (percentage >= 40)
        return { label: 'Moderate', action: 'muted' as const }; // Or warning
      return { label: 'Good', action: 'success' as const };
    }
  }, [current, goal, is_healthy]);

  const DisplaySize = size[propsSize] || size.xl;

  const DisplayColor = useMemo(() => {
    return getProgressTheme(current, goal, is_healthy);
  }, [current, goal, is_healthy]);

  const percentage = useMemo(() => {
    const raw = (current / goal) * 100;
    return Math.min(Math.max(raw, 0), 100);
  }, [current, goal]);

  return (
    <VStack>
      <HStack className="justify-between">
        <HStack className="flex-row gap-2">
          <Text>{icon}</Text>
          <Text size="lg" className="font-bold">
            {label}
          </Text>
        </HStack>
        <HStack className="flex-row">
          <Text size="lg" className="font-bold">
            {current}
            {unit} / {goal}
            {unit}
          </Text>
        </HStack>
      </HStack>
      <View className={`rounded-2xl bg-gray-300 ${DisplaySize}`}>
        <View
          className={`rounded-2xl ${DisplayColor} ${DisplaySize}`}
          style={{ width: `${percentage}%` }}
        ></View>
      </View>
      <Badge
        size="md"
        variant="solid"
        action={badgeStatus.action}
        className="mt-2 ml-auto rounded-full"
      >
        <BadgeText>{badgeStatus.label}</BadgeText>
      </Badge>
    </VStack>
  );
};

export default MacroProgressBar;
