import React, { useCallback, useEffect, useState } from 'react';
import { VStack } from '../../components/ui/vstack';
import { Text } from '../../components/ui/text';
import { HStack } from '../../components/ui/hstack';
import { Habit } from '../../types/types';
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {
  Trash2,
  CheckCircle,
  Circle,
  Plus,
  Bell,
  Phone,
} from 'lucide-react-native';
import { Button } from '../../components/ui/button';
import AppBar from '../../components/AppBar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../navigation/MainTabNavigator';
import useApi from '@/src/hooks/useApi';
import { cancelHabitReminder, cancelHabitCallSlot } from '../../services/habitScheduler';

function formatRescheduledTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const mm = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours}:${mm} ${ampm}`;
}

const HabitScreen = () => {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();

  const { loading, request } = useApi<Habit[]>();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHabits = useCallback(async () => {
    try {
      const fetchedHabits = await request({ url: '/habit/today' });
      setHabits(fetchedHabits || []);
    } catch (err) {
      console.error('Error fetching habits:', err);
    } finally {
      setIsInitialLoad(false);
    }
  }, [request]);

  useFocusEffect(
    useCallback(() => {
      fetchHabits();
    }, [fetchHabits]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchHabits();
    setRefreshing(false);
  };
  const [completedHabits, setCompletedHabits] = useState(0);

  const toggleHabit = async (id: string) => {
    try {
      setHabits(prev =>
        prev.map(habit =>
          habit.id === id ? { ...habit, completed: !habit.completed } : habit,
        ),
      );

      await request({
        url: `/habit/${id}/toggle`,
        method: 'POST',
        data: { habit: habits.find(habit => habit.id === id) },
      });
    } catch (err) {
      console.error('Error toggling habit:', err);
    }
  };

  useEffect(() => {
    setCompletedHabits(habits.filter(habit => habit.completed).length);
  }, [habits]);

  async function deleteHabit(id: string): Promise<void> {
    try {
      const habitToDelete = habits.find(h => h.id === id);
      setHabits(prev => prev.filter(habit => habit.id !== id));
      await cancelHabitReminder(id);

      // If this was a call-type habit, cancel the consolidated time-slot
      // notification if no other call habits remain at the same time.
      if (habitToDelete?.reminderType === 'call') {
        const remaining = habits.filter(
          h =>
            h.id !== id &&
            h.reminderTime === habitToDelete.reminderTime &&
            h.reminderType === 'call',
        );
        if (remaining.length === 0) {
          await cancelHabitCallSlot(habitToDelete.reminderTime);
        }
      }

      await request({
        url: `/habit/${id}`,
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Error deleting habit:', err);
    }
  }

  return (
    <View className="flex-1">
      <AppBar title="Habits" />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {isInitialLoad && loading ? (
          <VStack className="p-6 items-center justify-center">
            <Text>Loading habits...</Text>
          </VStack>
        ) : (
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
                  style={{
                    width: `${(completedHabits / habits.length) * 100}%`,
                  }}
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
                <VStack className="flex-1">
                  <Text
                    className={`font-medium mb-0.5 ${habit.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}
                  >
                    {habit.name}
                  </Text>
                  <HStack className="items-center gap-2 mt-0.5">
                    <Text size="xs" className="text-gray-500">
                      {habit.reminderTime}
                    </Text>
                    <Text size="xs" className="text-gray-300">
                      |
                    </Text>
                    <HStack className="items-center gap-1">
                      {habit.reminderType === 'call' ? (
                        <Phone size={10} color="#7C3AED" />
                      ) : (
                        <Bell size={10} color="#D97706" />
                      )}
                      <Text
                        size="xs"
                        className={
                          habit.reminderType === 'call'
                            ? 'text-purple-600'
                            : 'text-amber-600'
                        }
                      >
                        {habit.reminderType === 'call' ? 'Call' : 'Push'}
                      </Text>
                    </HStack>
                    <Text size="xs" className="text-gray-300">
                      |
                    </Text>
                    <Text
                      size="xs"
                      className={
                        habit.status === 'COMPLETED'
                          ? 'text-emerald-600 font-medium'
                          : habit.status === 'RESCHEDULED'
                            ? 'text-amber-600 font-medium'
                            : habit.status === 'MISSED'
                              ? 'text-red-500 font-medium'
                              : 'text-gray-400'
                      }
                    >
                      {habit.status === 'COMPLETED'
                        ? 'Completed'
                        : habit.status === 'RESCHEDULED'
                          ? `Rescheduled${habit.rescheduledTime ? ` for ${formatRescheduledTime(habit.rescheduledTime)}` : ''}`
                          : habit.status === 'MISSED'
                            ? 'Missed'
                            : 'Pending'}
                    </Text>
                  </HStack>
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
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        onPress={() => navigation.navigate('HabitCreation')}
        className="absolute bottom-36 right-6 w-14 h-14 rounded-full bg-emerald-500 items-center justify-center"
        style={styles.floatingButton}
      >
        <Plus size={28} color="#FFFFFF" strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingButton: {
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default HabitScreen;
