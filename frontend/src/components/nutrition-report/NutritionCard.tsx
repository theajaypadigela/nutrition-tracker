import React from 'react';
import { View } from 'react-native';
import { HStack } from '../ui/hstack';
import { VStack } from '../ui/vstack';
import { Nutrition } from './AllNutritionsCard';
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
      className="bg-white justify-between items-center border-b border-gray-200 p-4 h-auto rounded-none w-full data-[pressed=true]:bg-white data-[pressed=true]:border-gray-200 data-[pressed=true]:opacity-70"
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
