import React from 'react';
import { View } from 'react-native';
import { HStack } from '../ui/hstack';
import { VStack } from '../ui/vstack';
import { Nutrition, NutrientFlag } from './types';
import { Text } from '../ui/text';
import { Badge, BadgeText } from '../ui/badge';
import { Pressable } from '../ui/pressable';
import { Pin } from 'lucide-react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Flag helpers
// ─────────────────────────────────────────────────────────────────────────────

const FLAG_CONFIG: Record<
  NutrientFlag,
  { label: string; bar: string; badge: string; text: string }
> = {
  low: {
    label: 'Low',
    bar: '#f87171', // red-400
    badge: '#fef2f2', // red-50
    text: '#dc2626', // red-600
  },
  ok: {
    label: 'OK',
    bar: '#4ade80', // green-400
    badge: '#f0fdf4', // green-50
    text: '#16a34a', // green-600
  },
  high: {
    label: 'High',
    bar: '#fbbf24', // amber-400
    badge: '#fffbeb', // amber-50
    text: '#d97706', // amber-600
  },
  none: {
    label: '—',
    bar: '#d1d5db', // gray-300
    badge: '#f9fafb', // gray-50
    text: '#9ca3af', // gray-400
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

type Props = Nutrition & {
  onPress?: () => void;
  flag?: NutrientFlag;
  pctDV?: number;
  pinned?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const NutritionCard = ({
  name,
  unit,
  value,
  goal,
  type,
  onPress,
  flag = 'none',
  pctDV = 0,
  pinned = false,
}: Props) => {
  const config = FLAG_CONFIG[flag];
  const progressPct = Math.min(pctDV, 140); // cap bar at 140% so it doesn't overflow

  return (
    <Pressable
      onPress={onPress}
      className="bg-white px-4 pt-3 pb-3 border-b border-gray-100"
    >
      {/* Top row: name + badge | goal */}
      <HStack className="justify-between items-start mb-2">
        <VStack className="gap-1 flex-1 mr-3">
          <HStack className="gap-2 items-center">
            {pinned && <Pin size={12} color="#3b82f6" fill="#3b82f6" />}
            <Text size="sm" className="font-bold text-gray-800">
              {name}
            </Text>
            {/* Category badge */}
            <Badge
              size="sm"
              variant="solid"
              action="muted"
              style={{ backgroundColor: '#f1f5f9' }}
            >
              <BadgeText className="text-gray-500 text-[9px] font-semibold capitalize">
                {type}
              </BadgeText>
            </Badge>
          </HStack>

          {/* Current value */}
          <Text className="text-xs text-gray-400">
            {value > 0 ? `${value} ${unit} / day` : `No data logged`}
          </Text>
        </VStack>

        {/* Right: goal + status pill */}
        <VStack className="items-end gap-1">
          <Text className="text-xs text-gray-500">
            Goal: {goal} {unit}
          </Text>
          {flag !== 'none' && (
            <View
              style={{ backgroundColor: config.badge }}
              className="px-2 py-0.5 rounded-full"
            >
              <Text
                style={{ color: config.text }}
                className="text-[10px] font-semibold"
              >
                {config.label} · {pctDV}%
              </Text>
            </View>
          )}
        </VStack>
      </HStack>

      {/* Progress bar */}
      <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <View
          style={{
            width: `${progressPct}%`,
            backgroundColor: config.bar,
          }}
          className="h-full rounded-full"
        />
      </View>
    </Pressable>
  );
};

export default NutritionCard;
