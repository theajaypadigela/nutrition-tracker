import React, { useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import {
  Activity,
  Apple,
  CheckCircle2,
  XCircle,
  Plus,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import AppBar from '../../components/AppBar';

import { HStack } from '../../components/ui/hstack';
import { VStack } from '../../components/ui/vstack';
import { Divider } from '../../components/ui/divider';
import { Text } from '../../components/ui/text';
import { Heading } from '../../components/ui/heading';
import { CloseIcon, Icon } from '../../components/ui/icon';
import {
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
} from '../../components/ui/drawer';

import { DashboardResponse, FoodItem, Habit } from '../../types/types';
import { dashboardApi } from '../../features/dashboard/api/dashboardApi';
import { formatLocalDate } from '../../shared/date-time/localDate';
import type { MainTabParamList } from '../../navigation/MainTabNavigator';

type DashboardNavigationProp = BottomTabNavigationProp<
  MainTabParamList,
  'Home'
>;

const DashBoardScreen = () => {
  const navigation = useNavigation<DashboardNavigationProp>();
  const [showDrawer, setShowDrawer] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<string>(() =>
    formatLocalDate(),
  );
  const [dashboardData, setDashboardData] =
    React.useState<DashboardResponse | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await dashboardApi.getForDate(selectedDate);
      setDashboardData(response);
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    }
  }, [selectedDate]);

  React.useEffect(() => {
    if (selectedDate) fetchDashboard();
  }, [selectedDate, fetchDashboard]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  };

  const foodLogs: FoodItem[] = React.useMemo(() => {
    if (!dashboardData?.foodSummary?.meals) return [];
    return Object.values(dashboardData.foodSummary.meals).flat();
  }, [dashboardData]);

  const habits: Habit[] = dashboardData?.habits || [];

  const completedHabits = habits.filter(h => h.completed).length;
  const totalHabits = habits.length;
  const habitProgress = totalHabits > 0 ? completedHabits / totalHabits : 0;

  const foodTotals = dashboardData?.foodSummary?.totals || {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };

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
    setSelectedDate(day.dateString);
    setShowDrawer(true);
  };

  return (
    <View className="flex-1">
      <AppBar title="Dashboard" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <VStack className="gap-6 items-center p-4">
          <View className="w-full rounded-xl border border-gray-200 overflow-hidden">
            <Calendar hideExtraDays={true} onDayPress={handleDayPress} />
          </View>

          <VStack className="w-full bg-white rounded-2xl p-4 border border-gray-200 gap-3">
            <HStack className="flex items-center justify-between">
              <HStack className="items-center gap-2">
                <View className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                  <Activity size={18} stroke="#059669" strokeWidth={2.5} />
                </View>
                <Text size="xl" className="font-semibold text-gray-900">
                  Habits Today
                </Text>
              </HStack>
              <TouchableOpacity
                onPress={() => navigation.navigate('HabitCreation')}
                className="w-8 h-8 rounded-full bg-emerald-500 items-center justify-center"
              >
                <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            </HStack>

            <HStack className="justify-between items-center">
              <Text size="2xl" className="font-bold text-gray-900">
                {completedHabits} / {totalHabits}
              </Text>
              <Text className="text-gray-600">completed</Text>
            </HStack>

            <View className="w-full h-3 bg-gray-300 rounded-full overflow-hidden">
              <View
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${habitProgress * 100}%` }}
              />
            </View>

            <Text>{Math.round(habitProgress * 100)}% completed</Text>
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
                {Math.round(foodTotals.calories).toLocaleString()}
              </Text>
              <Text className="text-gray-600">calories</Text>
            </HStack>

            <Divider className="h-[1px] bg-gray-200" />

            <HStack className="justify-between items-center">
              <VStack>
                <Text className="text-gray-600">Protein</Text>
                <Text className="text-gray-900 font-bold">
                  {Math.round(foodTotals.protein)}g
                </Text>
              </VStack>

              <VStack>
                <Text className="text-gray-600">Carbs</Text>
                <Text className="text-gray-900 font-bold">
                  {Math.round(foodTotals.carbs)}g
                </Text>
              </VStack>

              <VStack>
                <Text className="text-gray-600">Fats</Text>
                <Text className="text-gray-900 font-bold">
                  {Math.round(foodTotals.fat)}g
                </Text>
              </VStack>
            </HStack>
          </VStack>
        </VStack>
      </ScrollView>

      <Drawer
        isOpen={showDrawer}
        size="lg"
        anchor="bottom"
        onClose={() => setShowDrawer(false)}
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
                {foodLogs.map(food => (
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
                ))}
              </VStack>
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </View>
  );
};

export default DashBoardScreen;
