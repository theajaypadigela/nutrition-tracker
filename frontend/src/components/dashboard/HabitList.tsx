import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Activity, Check, Plus } from 'lucide-react-native';

import { HStack } from '../ui/hstack';
import { VStack } from '../ui/vstack';
import { Text } from '../ui/text';
import { Habit } from '@/types/types';

interface HabitListProps {
  selectedDateLabel: string;
  isSelectedDateToday: boolean;
  isPastSelectedDate: boolean;
  incompleteHabitLabel: string;
  totalHabits: number;
  completedHabits: number;
  habitProgress: number;
  completedHabitItems: Habit[];
  incompleteHabitItems: Habit[];
  onCreateHabit: () => void;
}

/** The dashboard's main-body habits card: progress bar plus completed/incomplete splits. */
const HabitList = ({
  selectedDateLabel,
  isSelectedDateToday,
  isPastSelectedDate,
  incompleteHabitLabel,
  totalHabits,
  completedHabits,
  habitProgress,
  completedHabitItems,
  incompleteHabitItems,
  onCreateHabit,
}: HabitListProps) => (
  <VStack className="w-full bg-white rounded-2xl p-4 border border-gray-200 gap-3">
    <HStack className="flex items-center justify-between">
      <HStack className="items-center gap-2">
        <View className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
          <Activity size={18} stroke="#059669" strokeWidth={2.5} />
        </View>
        <Text size="xl" className="font-semibold text-gray-900">
          Habits for {selectedDateLabel}
        </Text>
      </HStack>
      {isSelectedDateToday ? (
        <TouchableOpacity
          onPress={onCreateHabit}
          className="w-10 h-10 rounded-full bg-emerald-500 items-center justify-center"
        >
          <Plus size={18} color="#FFFFFF" strokeWidth={2.7} />
        </TouchableOpacity>
      ) : null}
    </HStack>

    {totalHabits === 0 ? (
      <View className="rounded-xl bg-gray-50 border border-gray-200 p-4">
        <Text className="text-base font-semibold text-gray-900 mb-1">
          No habits scheduled
        </Text>
        <Text className={`text-sm text-gray-600 ${isSelectedDateToday ? 'mb-3' : ''}`}>
          {isSelectedDateToday
            ? 'Add a habit to start tracking progress for this date.'
            : 'Habits can only be created for today.'}
        </Text>
        {isSelectedDateToday ? (
          <TouchableOpacity
            onPress={onCreateHabit}
            className="self-start rounded-lg bg-emerald-600 px-4 py-2"
          >
            <Text className="text-white font-semibold">Create Habit</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    ) : (
      <>
        <HStack className="justify-between items-baseline mb-3">
          <Text className="text-base font-semibold text-gray-900">Habits</Text>
          <Text className="text-xs text-gray-400">
            {completedHabits} of {totalHabits} complete
          </Text>
        </HStack>

        <View className="w-full h-1 bg-emerald-50 rounded-full overflow-hidden mb-4">
          <View
            className="h-full bg-emerald-600 rounded-full"
            style={{ width: `${habitProgress * 100}%` }}
          />
        </View>

        <VStack className="gap-2">
          <HStack className="items-center gap-1.5 mb-2">
            <View className="w-[5px] h-[5px] rounded-full bg-emerald-600" />
            <Text className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">
              Completed
            </Text>
          </HStack>

          {completedHabitItems.length === 0 ? (
            <Text className="text-sm text-gray-500">No completed habits yet.</Text>
          ) : (
            completedHabitItems.map((item, index) => (
              <HStack
                key={`completed-${item.id}`}
                className={`items-center gap-3 py-2.5 ${
                  index < completedHabitItems.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <View className="w-[18px] h-[18px] rounded-full bg-emerald-600 items-center justify-center flex-shrink-0">
                  <Check size={9} color="#FFFFFF" strokeWidth={2.5} />
                </View>
                <Text className="flex-1 text-[13px] text-gray-900">{item.name}</Text>
                <View className="rounded-full bg-emerald-50 px-2.5 py-[3px]">
                  <Text className="text-[10px] font-medium text-emerald-600">Done</Text>
                </View>
              </HStack>
            ))
          )}
        </VStack>

        <View className="h-[0.5px] bg-gray-100 my-3.5" />

        <VStack className="gap-2">
          <HStack className="items-center gap-1.5 mb-2">
            <View className="w-[5px] h-[5px] rounded-full bg-red-300" />
            <Text className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">
              {incompleteHabitLabel}
            </Text>
          </HStack>

          {incompleteHabitItems.length === 0 ? (
            <Text className="text-sm text-gray-500">Nothing in {incompleteHabitLabel.toLowerCase()}.</Text>
          ) : (
            incompleteHabitItems.map((item, index) => (
              <HStack
                key={`incomplete-${item.id}`}
                className={`items-center gap-3 py-2.5 ${
                  index < incompleteHabitItems.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <View className="w-[18px] h-[18px] rounded-full border border-red-300 flex-shrink-0" />
                <Text className="flex-1 text-[13px] text-gray-400">{item.name}</Text>
                <View className="rounded-full bg-rose-50 px-2.5 py-[3px]">
                  <Text className="text-[10px] font-medium text-rose-500">
                    {isPastSelectedDate ? 'Missed' : 'Pending'}
                  </Text>
                </View>
              </HStack>
            ))
          )}
        </VStack>
      </>
    )}
  </VStack>
);

export default HabitList;
