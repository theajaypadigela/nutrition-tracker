import React, { useCallback } from 'react';
import { VStack } from '../../components/ui/vstack';
import { Text } from '../../components/ui/text';
import { HStack } from '../../components/ui/hstack';
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
  Clock,
} from 'lucide-react-native';
import { Button } from '../../components/ui/button';
import AppBar from '../../components/common/AppBar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../navigation/MainTabNavigator';
import { formatIsoTime12h } from '../../utils/timeFormatter';
import { useHabitList } from '../../hooks/useHabitList';

const REMINDER_TYPE_CALL = 'call';

const HabitScreen = () => {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const {
    habits,
    isInitialLoad,
    loading,
    refreshing,
    completedHabits,
    progressPercent,
    fetchHabits,
    refresh,
    toggleHabit,
    deleteHabit,
  } = useHabitList();

  useFocusEffect(
    useCallback(() => {
      fetchHabits();
    }, [fetchHabits]),
  );

  return (
    <View className="flex-1">
      <AppBar title="Habits" showProfileShortcut />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
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
                    width: `${progressPercent}%`,
                  }}
                />
              </View>
            </VStack>

            {habits.map(habit => {
              const isRescheduled = habit.status === 'RESCHEDULED';
              const rescheduledTime = habit.rescheduledTime
                ? formatIsoTime12h(habit.rescheduledTime)
                : '';

              return (
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
                        {habit.reminderType === REMINDER_TYPE_CALL ? (
                          <Phone size={10} color="#7C3AED" />
                        ) : (
                          <Bell size={10} color="#D97706" />
                        )}
                        <Text
                          size="xs"
                          className={
                            habit.reminderType === REMINDER_TYPE_CALL
                              ? 'text-purple-600'
                              : 'text-amber-600'
                          }
                        >
                          {habit.reminderType === REMINDER_TYPE_CALL ? 'Call' : 'Push'}
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
                            : isRescheduled
                              ? 'text-amber-600 font-medium'
                              : habit.status === 'MISSED'
                                ? 'text-red-500 font-medium'
                                : 'text-gray-400'
                        }
                      >
                        {habit.status === 'COMPLETED'
                          ? 'Completed'
                          : isRescheduled
                            ? 'Rescheduled'
                            : habit.status === 'MISSED'
                              ? 'Missed'
                              : 'Pending'}
                      </Text>
                    </HStack>
                    {isRescheduled && (
                      <HStack className="self-start max-w-full items-center gap-1 mt-2 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200">
                        <Clock size={12} color="#D97706" />
                        <Text
                          size="xs"
                          numberOfLines={2}
                          className="text-amber-700 font-medium flex-shrink"
                        >
                          {rescheduledTime
                            ? `Rescheduled for ${rescheduledTime}`
                            : 'Rescheduled for later'}
                        </Text>
                      </HStack>
                    )}
                  </VStack>
                  <Button
                    onPress={() => deleteHabit(habit.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-full ml-auto bg-red-50"
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </Button>
                </HStack>
              );
            })}
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
