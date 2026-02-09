import React from 'react';
import { View } from 'react-native';
import { HStack } from './ui/hstack';
import { Activity, Apple, CheckCircle2, XCircle } from 'lucide-react-native';

import { VStack } from './ui/vstack';
import { Divider } from './ui/divider';
import { Text } from './ui/text';
import { Calendar, DateData } from 'react-native-calendars';
import { FoodLog, Habit } from '../types/types';
import {
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
} from './ui/drawer';
import { Heading } from './ui/heading';
import { CloseIcon, Icon } from './ui/icon';
import { Button, ButtonText } from './ui/button';

const DashBoardScreen = () => {
  const [showDrawer, setShowDrawer] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<string>('');

  const foodLogs: FoodLog[] = [
    { id: '1', name: 'Apple', calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
    {
      id: '2',
      name: 'Chicken Breast',
      calories: 165,
      protein: 31,
      carbs: 0,
      fat: 3.6,
    },
    {
      id: '3',
      name: 'Brown Rice',
      calories: 216,
      protein: 5,
      carbs: 44,
      fat: 1.8,
    },
    {
      id: '4',
      name: 'Banana',
      calories: 105,
      protein: 1.3,
      carbs: 27,
      fat: 0.4,
    },
  ];

  const habits: Habit[] = [
    { id: '1', name: 'Drink Water', completed: true },
    { id: '2', name: 'Exercise', completed: false },
    { id: '3', name: 'Read a Book', completed: true },
    { id: '4', name: 'Read a Book', completed: true },
    { id: '5', name: 'Read a Book', completed: false },
    { id: '6', name: 'Read a Book', completed: true },
    { id: '7', name: 'Read a Book', completed: false },
    { id: '8', name: 'Read a Book', completed: true },
    { id: '9', name: 'Read a Book', completed: false },
    { id: '10', name: 'Read a Book', completed: true },
    { id: '11', name: 'Read a Book', completed: true },
    { id: '12', name: 'Read a Book', completed: false },
    { id: '13', name: 'Read a Book', completed: true },
    { id: '14', name: 'Read a Book', completed: false },
    { id: '15', name: 'Read a Book', completed: true },
    { id: '16', name: 'Read a Book', completed: true },
    { id: '17', name: 'Read a Book', completed: true },
    { id: '18', name: 'Read a Book', completed: true },
    { id: '19', name: 'Read a Book', completed: true },
    { id: '20', name: 'Read a Book', completed: true },
    { id: '21', name: 'Read a Book', completed: true },
    { id: '22', name: 'Read a Book', completed: true },
    { id: '23', name: 'Read a Book', completed: true },
  ];

  const getOrdinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      const day = date.getDate();
      const month = date.toLocaleString('default', { month: 'long' });
      const year = date.getFullYear();
      return `${getOrdinal(day)} ${month} ${year}`;
    }
  };

  const handleDayPress = (day: DateData) => {
    console.log(day.dateString);
    setSelectedDate(day.dateString);
    setShowDrawer(true);
  };
  return (
    <>
      <VStack className="flex-1 gap-6 items-center p-4">
        <View
          className="w-full rounded-xl border border-gray-200"
          style={{ overflow: 'hidden' }}
        >
          <Calendar hideExtraDays={true} onDayPress={handleDayPress} />
        </View>

        <VStack className="w-full bg-white rounded-2xl p-4 border border-gray-200 gap-3">
          <HStack className="flex items-center gap-2">
            <View className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <Activity size={18} stroke="#059669" strokeWidth={2.5} />
            </View>
            <Text size="xl" className="font-semibold text-gray-900">
              Habits Today
            </Text>
          </HStack>
          <HStack className="justify-between items-center">
            <Text size="2xl" className="font-bold text-gray-900">
              2 / 3
            </Text>
            <Text className="text-gray-600">completed</Text>
          </HStack>
          <View
            className="w-full h-3 bg-gray-300 rounded-full"
            style={{ overflow: 'hidden' }}
          >
            <View
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${(2 / 3) * 100}%` }}
            />
          </View>
          <Text>{Math.round((2 / 3) * 100)}% completed</Text>
        </VStack>

        <VStack className="w-full bg-white rounded-2xl p-4 border border-gray-200 gap-3">
          <HStack className="flex items-center gap-2">
            <View className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <Apple size={18} stroke="#059669" strokeWidth={2.5} />
            </View>
            <Text size="xl" className="font-semibold text-gray-900">
              Food Summary
            </Text>
          </HStack>
          <HStack className="justify-between items-center">
            <Text size="2xl" className="font-bold text-gray-900">
              1,290
            </Text>
            <Text className="text-gray-600">calories</Text>
          </HStack>
          <Divider className="h-[1px] bg-gray-200" />
          <HStack className="justify-between items-center">
            <VStack>
              <Text className="text-gray-600">Protien</Text>
              <Text className="text-gray-900 font-bold">150g</Text>
            </VStack>
            <VStack>
              <Text className="text-gray-600">Carbs</Text>
              <Text className="text-gray-900 font-bold">150g</Text>
            </VStack>
            <VStack>
              <Text className="text-gray-600">Fats</Text>
              <Text className="text-gray-900 font-bold">150g</Text>
            </VStack>
          </HStack>
        </VStack>
      </VStack>
      <Drawer
        isOpen={showDrawer}
        size="lg"
        anchor="bottom"
        onClose={() => {
          setShowDrawer(false);
        }}
      >
        <DrawerBackdrop />
        <DrawerContent className="p-0">
          <DrawerHeader className="p-6 border-b-2 border-gray-200 pb-2">
            <Heading size="lg">
              {selectedDate ? formatDate(selectedDate) : 'Select a date'}
            </Heading>
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
                {habits.map(item => (
                  <HStack
                    key={item.id}
                    className="p-6 bg-gray-100 rounded-lg gap-4"
                  >
                    {item.completed ? (
                      <CheckCircle2 size={20} color="#10B981" />
                    ) : (
                      <XCircle size={20} color="#EF4444" />
                    )}
                    <Text className="rounded-lg text-gray-900 font-medium">
                      {item.name}
                    </Text>
                  </HStack>
                ))}
              </VStack>
              <Text size="lg" className="text-gray-800 font-bold">
                Food Log
              </Text>
              <HStack className="w-full bg-emerald-50 rounded-xl p-3 mb-3">
                <HStack className="justify-between w-full">
                  <View className="flex-1 flex-col items-center gap-1">
                    <Text className="text-xs text-gray-600">Calories</Text>
                    <Text className="text-sm font-semibold text-gray-900">
                      1290g
                    </Text>
                  </View>
                  <View className="flex-1 flex-col items-center gap-1">
                    <Text className="text-xs text-gray-600">Protein</Text>
                    <Text className="text-sm font-semibold text-gray-900">
                      1290g
                    </Text>
                  </View>
                  <View className="flex-1 flex-col items-center gap-1">
                    <Text className="text-xs text-gray-600">Carbohydrates</Text>
                    <Text className="text-sm font-semibold text-gray-900">
                      1290g
                    </Text>
                  </View>
                  <View className="flex-1 flex-col items-center gap-1">
                    <Text className="text-xs text-gray-600">Fats</Text>
                    <Text className="text-sm font-semibold text-gray-900">
                      1290g
                    </Text>
                  </View>
                </HStack>
              </HStack>
              <VStack className="gap-2">
                {foodLogs.map(food => (
                  <View key={food.id} className="p-3 rounded-xl bg-gray-50">
                    <Text className="text-sm font-medium text-gray-900 mb-1">
                      {food.name}
                    </Text>
                    <HStack className="gap-4">
                      <Text className="text-xs text-gray-600">
                        {food.calories} cal
                      </Text>
                      <Text className="text-xs text-gray-600">
                        P: {food.protein}g
                      </Text>
                      <Text className="text-xs text-gray-600">
                        C: {food.carbs}g
                      </Text>
                      <Text className="text-xs text-gray-600">
                        F: {food.fat}g
                      </Text>
                    </HStack>
                  </View>
                ))}
              </VStack>
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default DashBoardScreen;
