import React from 'react';
import { View } from 'react-native';
import { Check } from 'lucide-react-native';

import { HStack } from '../ui/hstack';
import { VStack } from '../ui/vstack';
import { Text } from '../ui/text';
import { CloseIcon, Icon } from '../ui/icon';
import {
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
} from '../ui/drawer';
import { FoodItem, Habit } from '@/types/types';
import { FoodMacros } from '@/utils/foodCalculations';

interface DayDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  habits: Habit[];
  foodTotals: FoodMacros;
  foodLogs: FoodItem[];
}

/** Bottom drawer with the selected day's habit checklist and food log summary. */
const DayDetailDrawer = ({
  isOpen,
  onClose,
  title,
  habits,
  foodTotals,
  foodLogs,
}: DayDetailDrawerProps) => (
  <Drawer isOpen={isOpen} size="lg" anchor="bottom" onClose={onClose}>
    <DrawerBackdrop className="bg-black/40" />

    <DrawerContent className="p-0 rounded-t-3xl bg-white">
      <DrawerHeader className="p-6 border-b border-gray-200 pb-3">
        <Text size="xl" className="font-bold text-gray-900">
          {title}
        </Text>

        <Text className="text-sm text-gray-600 mt-1">
          Daily details and completion status
        </Text>

        <DrawerCloseButton>
          <Icon as={CloseIcon} />
        </DrawerCloseButton>
      </DrawerHeader>

      <DrawerBody className="p-6">
        <VStack className="gap-6">
          <Text size="lg" className="text-gray-800 font-bold">
            Habits
          </Text>

          <VStack className="gap-2">
            {habits.length === 0 ? (
              <View className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                <Text className="text-sm text-gray-700">
                  No habits to review for this date.
                </Text>
              </View>
            ) : (
              habits.map(item => (
                <HStack
                  key={item.id}
                  className="p-4 bg-gray-100 rounded-lg gap-4 items-center"
                >
                  {item.completed ? (
                    <View className="w-[20px] h-[20px] rounded-full bg-gray-900 items-center justify-center">
                      <Check size={10} color="#FFFFFF" strokeWidth={2.5} />
                    </View>
                  ) : (
                    <View className="w-[20px] h-[20px] rounded-full border border-gray-300" />
                  )}

                  <Text className="rounded-lg text-gray-900 font-medium">
                    {item.name}
                  </Text>
                </HStack>
              ))
            )}
          </VStack>

          <Text size="lg" className="text-gray-800 font-bold">
            Food Log
          </Text>

          <HStack className="w-full bg-emerald-50 rounded-xl p-3 mb-3">
            <HStack className="justify-between w-full">
              <View className="flex-1 flex-col items-center gap-1">
                <Text className="text-xs text-gray-600">Calories</Text>
                <Text className="text-sm font-semibold text-gray-900">
                  {Math.round(foodTotals.calories)} cal
                </Text>
              </View>

              <View className="flex-1 flex-col items-center gap-1">
                <Text className="text-xs text-gray-600">Protein</Text>
                <Text className="text-sm font-semibold text-gray-900">
                  {Math.round(foodTotals.protein)}g
                </Text>
              </View>

              <View className="flex-1 flex-col items-center gap-1">
                <Text className="text-xs text-gray-600">Carbs</Text>
                <Text className="text-sm font-semibold text-gray-900">
                  {Math.round(foodTotals.carbs)}g
                </Text>
              </View>

              <View className="flex-1 flex-col items-center gap-1">
                <Text className="text-xs text-gray-600">Fats</Text>
                <Text className="text-sm font-semibold text-gray-900">
                  {Math.round(foodTotals.fat)}g
                </Text>
              </View>
            </HStack>
          </HStack>

          <VStack className="gap-2">
            {foodLogs.length === 0 ? (
              <View className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                <Text className="text-sm text-gray-700">
                  No meals logged for this date.
                </Text>
              </View>
            ) : (
              foodLogs.map(food => (
                <View key={food.id} className="p-3 rounded-xl bg-gray-50">
                  <Text className="text-sm font-medium text-gray-900 mb-1">
                    {food.name}
                  </Text>

                  <HStack className="gap-4">
                    <Text className="text-xs text-gray-600">
                      {Math.round(food.calories || 0)} cal
                    </Text>

                    <Text className="text-xs text-gray-600">
                      P: {Math.round(food.protein || 0)}g
                    </Text>

                    <Text className="text-xs text-gray-600">
                      C: {Math.round(food.carbs || 0)}g
                    </Text>

                    <Text className="text-xs text-gray-600">
                      F: {Math.round(food.fat || 0)}g
                    </Text>
                  </HStack>
                </View>
              ))
            )}
          </VStack>
        </VStack>
      </DrawerBody>
    </DrawerContent>
  </Drawer>
);

export default DayDetailDrawer;
