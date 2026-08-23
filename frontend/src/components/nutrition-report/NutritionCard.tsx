import React from 'react';
import { tokens } from '@/theme/tokens';
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
    bar: tokens.nutrientFlag.lowBar, // red-400
    badge: tokens.nutrientFlag.lowBadge, // red-50
    text: tokens.nutrientFlag.lowText, // red-600
  },
  ok: {
    label: 'OK',
    bar: tokens.nutrientFlag.okBar, // green-400
    badge: tokens.nutrientFlag.okBadge, // green-50
    text: tokens.nutrientFlag.okText, // green-600
  },
  high: {
    label: 'High',
    bar: tokens.nutrientFlag.highBar, // amber-400
    badge: tokens.nutrientFlag.highBadge, // amber-50
    text: tokens.nutrientFlag.highText, // amber-600
  },
  none: {
    label: '—',
    bar: tokens.nutrientFlag.noneBar, // gray-300
    badge: tokens.nutrientFlag.noneBadge, // gray-50
    text: tokens.nutrientFlag.noneText, // gray-400
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
            {pinned && <Pin size={12} color={tokens.nutrientFlag.pin} fill={tokens.nutrientFlag.pin} />}
            <Text size="sm" className="font-bold text-gray-800">
              {name}
            </Text>
            {/* Category badge */}
            <Badge
              size="sm"
              variant="solid"
              action="muted"
              style={{ backgroundColor: tokens.nutrientFlag.track }}
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
