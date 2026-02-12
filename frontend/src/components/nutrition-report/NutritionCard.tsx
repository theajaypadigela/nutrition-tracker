import React from 'react';
import { View } from 'react-native';
import { HStack } from '../ui/hstack';
import { VStack } from '../ui/vstack';
import { Nutrition } from './types';
import { Text } from '../ui/text';
import { Badge, BadgeText, BadgeIcon } from '../ui/badge';
import { Pressable } from '../ui/pressable';

const NutritionCard = ({
  name,
  unit,
  value,
  goal,
  type,
  onPress,
}: Nutrition & { onPress?: () => void }) => {
  return (
    <Pressable
      onPress={onPress}
      className="bg-white justify-between flex-row p-4 border-b border-gray-200"
    >
      <VStack className="gap-2">
        <HStack className="gap-2">
          <Text size="md" className="font-bold">
            {name}
          </Text>
          <Badge size="md" variant="solid" action="muted">
            <BadgeText className="text-gray-500 font-semibold">
              {type}
            </BadgeText>
          </Badge>
        </HStack>
        <HStack className="gap-1">
          <Text className="text-gray-400 font-semibold">{value}</Text>
          <Text className="text-gray-400 font-semibold">{unit}</Text>
        </HStack>
      </VStack>
      <HStack className="gap-1">
        <Text>{goal}</Text>
        <Text>{unit}</Text>
      </HStack>
    </Pressable>
  );
};

export default NutritionCard;
