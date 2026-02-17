import React, { useEffect, useState } from 'react';
import { VStack } from '../../components/ui/vstack';
import { Text } from '../../components/ui/text';
import { HStack } from '../../components/ui/hstack';
import { Habit } from '../../types/types';
import { View } from 'react-native';
import { Trash2, CheckCircle, Circle } from 'lucide-react-native';
import { Button } from '../../components/ui/button';
import AppBar from '../../components/AppBar';

const HabitScreen = () => {
  const initialHabits: Habit[] = [
    {
      id: '1',
      name: 'Morning Run',
      completed: true,
      time: '07:00 AM',
      repeatedDays: 'Mon, Wed, Fri',
    },
    {
      id: '2',
      name: 'Read Books',
      completed: false,
      time: '08:00 PM',
      repeatedDays: 'Daily',
    },
    {
      id: '3',
      name: 'Meditation',
      completed: true,
      time: '06:30 AM',
      repeatedDays: 'Tue, Thu',
    },
  ];
  const [habits, setHabits] = useState(initialHabits);
  const [completedHabits, setCompletedHabits] = useState(0);

  const toggleHabit = (id: string) => {
    setHabits(prev =>
      prev.map(habit =>
        habit.id === id ? { ...habit, completed: !habit.completed } : habit,
      ),
    );
  };

  useEffect(() => {
    setCompletedHabits(habits.filter(habit => habit.completed).length);
  }, [habits]);

  function deleteHabit(id: string): void {
    setHabits(prev => prev.filter(habit => habit.id !== id));
  }

  return (
    <View className="flex-1">
      <AppBar title="Habits" />
      <VStack className="p-6 gap-4">
        <VStack className="gap-4 bg-white p-6 rounded-lg border-2 border-gray-200 mb-4">
          <Text size="xl" className="font-bold text-gray-700 mb-2">
            Today's Progress
          </Text>
          <HStack className="flex-row justify-between items-center">
            <Text size="5xl" className="font-bold text-gray-900">
              {completedHabits} / {habits.length}
            </Text>
            <Text>Completed Today</Text>
          </HStack>
          <View className="w-full h-3 bg-gray-300 rounded-full overflow-hidden">
            <View
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${(completedHabits / habits.length) * 100}%` }}
            />
          </View>
        </VStack>

        {habits.map(habit => (
          <HStack
            key={habit.id}
            className="rounded-xl p-4 border-2 border-gray-200 flex items-center gap-4 bg-white"
          >
            <Button variant="link" onPress={() => toggleHabit(habit.id)}>
              {habit.completed ? (
                <CheckCircle size={24} color="#059669" />
              ) : (
                <Circle size={24} color="#9CA3AF" />
              )}
            </Button>
            <VStack>
              <Text
                className={`font-medium mb-0.5 ${habit.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}
              >
                {habit.name}
              </Text>
              <Text size="xs" className="text-gray-500">
                {habit.time} | {habit.repeatedDays}
              </Text>
            </VStack>
            <Button
              onPress={() => deleteHabit(habit.id)}
              className="w-8 h-8 flex items-center justify-center rounded-full ml-auto bg-red-50"
            >
              <Trash2 size={16} color="#EF4444" />
            </Button>
          </HStack>
        ))}
      </VStack>
    </View>
  );
};

export default HabitScreen;
