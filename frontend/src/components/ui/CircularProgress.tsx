import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { VStack } from './vstack';
import { Text } from './text';
import { HStack } from './hstack';
import { Badge, BadgeText } from './badge';

interface BadgeStatusType {
  label: string;
  action: 'success' | 'error' | 'warning' | 'muted' | 'info';
}

interface CircularProgressProps {
  // Required props
  goal: number;
  current: number;

  // Display customization
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  label?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  unit?: string;
  variant?: 'main' | 'normal' | 'badge';

  // Progress behavior
  is_healthy?: boolean;
  showPercentage?: boolean;
  showBadge?: boolean;

  // Color customization
  progressColor?: string;
  backgroundColor?: string;

  // Advanced customization
  strokeWidthMultiplier?: number;
  customBadgeStatus?: BadgeStatusType;

  // Formatting
  formatValue?: (value: number) => string;
}

// Hex codes for tailwind colors - moved outside component to avoid recreating on every render
const DEFAULT_COLORS = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  blue: '#3b82f6',
  gray: '#d1d5db',
};

const CircularProgress: React.FC<CircularProgressProps> = ({
  goal,
  current,
  size = 'md',
  label,
  subtitle,
  icon,
  unit,
  is_healthy = true,
  variant = 'normal',
  showPercentage = true,
  showBadge = false,
  progressColor: customProgressColor,
  backgroundColor: customBackgroundColor,
  strokeWidthMultiplier = 0.1,
  customBadgeStatus,
  formatValue,
}) => {
  // Size mapping for the circle diameter
  const sizeMap = {
    sm: 80,
    md: 120,
    lg: 160,
    xl: 200,
    '2xl': 240,
  };

  // Badge styles adjustments
  const badgeSizeMap = {
    sm: 40,
    md: 60,
    lg: 80,
    xl: 100,
    '2xl': 120,
  };

  const currentSize =
    variant === 'badge' ? badgeSizeMap[size] || 60 : sizeMap[size];
  const strokeWidth = currentSize * strokeWidthMultiplier; // Configurable stroke width
  const radius = (currentSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const colors = {
    ...DEFAULT_COLORS,
    gray: customBackgroundColor || DEFAULT_COLORS.gray, // Use custom background color if provided
  };

  const badgeStatus = useMemo(() => {
    // Use custom badge status if provided
    if (customBadgeStatus) {
      return customBadgeStatus;
    }

    const percentage = (current / goal) * 100;

    if (is_healthy) {
      if (percentage > 100)
        return { label: 'Exceed', action: 'success' as const };
      if (percentage >= 80)
        return { label: 'Normal', action: 'success' as const };
      if (percentage >= 40)
        return { label: 'Moderate', action: 'warning' as const };
      return { label: 'Low', action: 'error' as const };
    } else {
      if (percentage > 100)
        return { label: 'Over Limit', action: 'error' as const };
      if (percentage >= 80)
        return { label: 'High', action: 'warning' as const };
      if (percentage >= 40)
        return { label: 'Moderate', action: 'muted' as const };
      return { label: 'Good', action: 'success' as const };
    }
  }, [current, goal, is_healthy, customBadgeStatus]);

  const progressColor = useMemo(() => {
    // Use custom progress color if provided
    if (customProgressColor) {
      return customProgressColor;
    }

    const percentage = (current / goal) * 100;

    if (is_healthy) {
      if (percentage >= 100) return colors.blue;
      if (percentage >= 80) return colors.green;
      if (percentage >= 40) return colors.yellow;
      return colors.red;
    } else {
      if (percentage > 100) return colors.red;
      if (percentage >= 80) return colors.yellow;
      return colors.green;
    }
  }, [
    current,
    goal,
    is_healthy,
    customProgressColor,
    colors.blue,
    colors.green,
    colors.red,
    colors.yellow,
  ]);

  const percentage = Math.min(Math.max((current / goal) * 100, 0), 100);
  const strokeDashoffset = circumference - (circumference * percentage) / 100;

  const CircularChart = () => (
    <View
      style={{
        width: currentSize,
        height: currentSize,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Svg width={currentSize} height={currentSize}>
        {/* Background Circle */}
        <Circle
          stroke={colors.gray}
          fill="none"
          cx={currentSize / 2}
          cy={currentSize / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />

        {/* Progress Circle */}
        <Circle
          stroke={progressColor}
          fill="none"
          cx={currentSize / 2}
          cy={currentSize / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${currentSize / 2}, ${currentSize / 2}`}
        />
      </Svg>

      {variant === 'normal' && showPercentage && (
        <View className="absolute items-center justify-center">
          {icon && <View className="mb-1">{icon}</View>}
          <Text className="text-xl font-bold">{Math.round(percentage)}%</Text>
        </View>
      )}
      {(variant === 'main' || variant === 'badge') && (
        <View className="absolute items-center justify-center">
          {icon && <View className="mb-1">{icon}</View>}
          {variant === 'badge' && showPercentage && (
            <Text className="text-xs font-bold">{Math.round(percentage)}%</Text>
          )}
        </View>
      )}
    </View>
  );

  if (variant === 'main') {
    return (
      <HStack className="items-center gap-4">
        <CircularChart />
        <VStack>
          <Text className="text-3xl font-bold">
            {formatValue ? formatValue(current) : Math.round(current)}
          </Text>
          <Text className="text-sm text-gray-500">
            of {formatValue ? formatValue(goal) : goal} {unit} {label}
          </Text>
          {subtitle && (
            <Text className="text-xs text-gray-400 mt-1">{subtitle}</Text>
          )}
        </VStack>
      </HStack>
    );
  }

  if (variant === 'badge') {
    return (
      <Badge
        variant="outline"
        action={badgeStatus.action}
        className="flex-row items-center gap-2 pr-4 rounded-full border"
      >
        <CircularChart />
        <VStack>
          <Text className="text-xs font-bold text-typography-700">{label}</Text>
          <Text className="text-xs text-typography-500">
            {formatValue ? formatValue(current) : Math.round(current)}
            {unit} • {Math.round(percentage)}%
          </Text>
          {subtitle && (
            <Text className="text-xs text-typography-400">{subtitle}</Text>
          )}
        </VStack>
      </Badge>
    );
  }

  // Default: 'normal'
  return (
    <VStack className="items-center justify-center p-4">
      <CircularChart />
      <VStack className="mt-2 items-center gap-1">
        <Text className="font-bold text-lg">
          {formatValue ? formatValue(current) : Math.round(current)}
          {unit}
        </Text>
        <Text className="text-sm text-gray-500">{label}</Text>
        {subtitle && <Text className="text-xs text-gray-400">{subtitle}</Text>}
      </VStack>
      {showBadge && (
        <Badge
          size="md"
          variant="solid"
          action={badgeStatus.action}
          className="mt-2 rounded-full"
        >
          <BadgeText>{badgeStatus.label}</BadgeText>
        </Badge>
      )}
    </VStack>
  );
};

export default CircularProgress;
