import React, { useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import {
  Activity,
  Apple,
  Check,
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import AppBar from '../../components/AppBar';

import { HStack } from '../../components/ui/hstack';
import { VStack } from '../../components/ui/vstack';
import { Divider } from '../../components/ui/divider';
import { Text } from '../../components/ui/text';
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
import apiClient from '../../api/client';
import {
  addDaysToLocalDate,
  getTodayLocalDate,
  isSameLocalCalendarDay,
  parseLocalDateString,
} from '../../utils/date';
import { normalizeMeals } from '../../utils/meals';

const MEAL_SLOTS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'snack', label: 'Snack' },
  { key: 'dinner', label: 'Dinner' },
] as const;
const MEAL_SLOT_ORDER = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
const EMPTY_HABITS: Habit[] = [];
const EMPTY_FOOD_TOTALS = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
} as const;

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 100,
  },
  emptyCalendarDay: {
    width: 40,
    height: 40,
  },
  calendarDayBase: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    borderColor: 'transparent',
    opacity: 1,
  },
  calendarDaySelected: {
    backgroundColor: '#059669',
  },
  calendarDayToday: {
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  calendarDayDisabled: {
    opacity: 0.45,
  },
  calendarDayText: {
    fontSize: 14,
  },
  calendarDayDot: {
    marginTop: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#10B981',
  },
  calendar: {
    borderRadius: 20,
    paddingBottom: 8,
  },
});

const DashBoardScreen = () => {
  const navigation = useNavigation<any>();
  const [showDrawer, setShowDrawer] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<string>(getTodayLocalDate);
  const todayKey = React.useMemo(() => getTodayLocalDate(), []);
  const [visibleMonthLabel, setVisibleMonthLabel] = React.useState<string>(() => {
    const selected = new Date();
    return selected.toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });
  });
  const [dashboardData, setDashboardData] =
    React.useState<DashboardResponse | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [expandedMeal, setExpandedMeal] = React.useState<string | null>(null);

  const toggleMeal = (mealKey: string) => {
    setExpandedMeal(prev => (prev === mealKey ? null : mealKey));
  };

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await apiClient.get<DashboardResponse>(
        `/dashboard/${selectedDate}`,
      );
      setDashboardData(response.data);
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

  const normalizedMeals = React.useMemo(
    () => normalizeMeals(dashboardData?.foodSummary?.meals),
    [dashboardData],
  );

  const foodLogs: FoodItem[] = React.useMemo(() => {
    return Object.values(normalizedMeals).flat();
  }, [normalizedMeals]);

  const habits: Habit[] = dashboardData?.habits ?? EMPTY_HABITS;

  const completedHabits = habits.filter(h => h.completed).length;
  const totalHabits = habits.length;
  const habitProgress = totalHabits > 0 ? completedHabits / totalHabits : 0;
  const completedHabitItems = React.useMemo(
    () => habits.filter(h => h.completed),
    [habits],
  );
  const incompleteHabitItems = React.useMemo(
    () => habits.filter(h => !h.completed),
    [habits],
  );

  const foodTotals = dashboardData?.foodSummary?.totals ?? EMPTY_FOOD_TOTALS;
  const dailyMacroSummaryItems = React.useMemo(
    () => [
      { label: 'Calories', value: `${Math.round(foodTotals.calories)}`, green: true },
      { label: 'Protein', value: `${Math.round(foodTotals.protein)}g`, green: false },
      { label: 'Carbs', value: `${Math.round(foodTotals.carbs)}g`, green: false },
      { label: 'Fats', value: `${Math.round(foodTotals.fat)}g`, green: false },
    ],
    [foodTotals],
  );
  const mealStatusItems = React.useMemo(() => {
    return MEAL_SLOT_ORDER.map(key => {
      const slot = MEAL_SLOTS.find(item => item.key === key)!;
      const entries = normalizedMeals[key] || [];
      return {
        ...slot,
        logged: entries.length > 0,
        count: entries.length,
      };
    });
  }, [normalizedMeals]);
  const loggedMealItems = React.useMemo(
    () => mealStatusItems.filter(slot => slot.logged),
    [mealStatusItems],
  );
  const missingMealItems = React.useMemo(
    () => mealStatusItems.filter(slot => !slot.logged),
    [mealStatusItems],
  );
  const expandedMealDetails = React.useMemo(() => {
    if (!expandedMeal) return null;

    const mealFoods = normalizedMeals[expandedMeal] || [];
    const slot = MEAL_SLOTS.find(s => s.key === expandedMeal);
    const totalCal = mealFoods.reduce((s, f) => s + (f.calories || 0), 0);
    const totalProt = mealFoods.reduce((s, f) => s + (f.protein || 0), 0);
    const totalCarb = mealFoods.reduce((s, f) => s + (f.carbs || 0), 0);
    const totalFat = mealFoods.reduce((s, f) => s + (f.fat || 0), 0);

    return {
      slotLabel: slot?.label,
      mealFoods,
      macroItems: [
        { label: 'cal', value: Math.round(totalCal) },
        { label: 'protein', value: `${Math.round(totalProt)}g` },
        { label: 'carbs', value: `${Math.round(totalCarb)}g` },
        { label: 'fats', value: `${Math.round(totalFat)}g` },
      ],
    };
  }, [expandedMeal, normalizedMeals]);

  const isPastSelectedDate = selectedDate < todayKey;
  const incompleteHabitLabel = isPastSelectedDate ? 'Missed' : 'Not Completed';
  const missingMealLabel = isPastSelectedDate ? 'Missed Meals' : 'Not Logged Yet';

  const calendarMarkedDates = React.useMemo(() => {
    const marked: Record<string, any> = {
      [selectedDate]: {
        selected: true,
        selectedColor: '#059669',
        selectedTextColor: '#FFFFFF',
      },
    };

    if (todayKey !== selectedDate) {
      marked[todayKey] = {
        marked: true,
        dotColor: '#0F766E',
      };
    }

    return marked;
  }, [selectedDate, todayKey]);

  const getOrdinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const formatDate = (dateString: string) => {
    const date = parseLocalDateString(dateString);
    const today = new Date();
    const yesterday = addDaysToLocalDate(today, -1);

    if (isSameLocalCalendarDay(date, today)) {
      return 'Today';
    } else if (isSameLocalCalendarDay(date, yesterday)) {
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
    setShowDrawer(day.dateString === todayKey);
  };

  const handleTodayPress = () => {
    setSelectedDate(todayKey);
    const today = parseLocalDateString(todayKey);
    setVisibleMonthLabel(
      today.toLocaleString('default', {
        month: 'long',
        year: 'numeric',
      }),
    );
  };

  const handleMonthChange = (month: DateData) => {
    const monthDate = new Date(month.year, month.month - 1, 1);
    setVisibleMonthLabel(
      monthDate.toLocaleString('default', {
        month: 'long',
        year: 'numeric',
      }),
    );
  };

  const selectedDateLabel = selectedDate ? formatDate(selectedDate) : 'Selected day';
  const isSelectedDateToday = selectedDate === todayKey;
  const canLogFoodForSelectedDate = isSelectedDateToday;

  const renderCalendarDay = ({ date, state, marking }: any) => {
    if (!date) {
      return <View style={styles.emptyCalendarDay} />;
    }

    const isSelected = date.dateString === selectedDate;
    const isToday = date.dateString === todayKey;
    const isDisabled = state === 'disabled';
    const showDot = !isSelected && (isToday || Boolean(marking?.marked));

    return (
      <TouchableOpacity
        onPress={() => handleDayPress(date)}
        activeOpacity={0.85}
        className="items-center justify-center"
        style={[
          styles.calendarDayBase,
          isSelected ? styles.calendarDaySelected : null,
          isToday && !isSelected ? styles.calendarDayToday : null,
          isDisabled ? styles.calendarDayDisabled : null,
        ]}
      >
        <Text
          className={
            isSelected
              ? 'text-white font-bold'
              : isDisabled
                ? 'text-gray-400 font-medium'
                : 'text-gray-900 font-semibold'
          }
          style={styles.calendarDayText}
        >
          {date.day}
        </Text>

        {showDot ? <View style={styles.calendarDayDot} /> : null}
      </TouchableOpacity>
    );
  };

  const handleLogFoodPress = () => {
    navigation.navigate('Food' as any, { screen: 'FoodLog' } as any);
  };

  return (
    <View className="flex-1 bg-white">
      <AppBar title="Dashboard" showProfileShortcut />
      <ScrollView
        className="bg-white"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <VStack className="gap-6 items-center p-4">
          <View className="w-full rounded-3xl border border-emerald-100 bg-white p-4">
            <HStack className="items-center justify-between px-1 pb-2">
              <HStack className="items-center gap-2">
                <View className="w-9 h-9 rounded-full bg-emerald-50 items-center justify-center">
                  <CalendarDays size={16} color="#047857" strokeWidth={2.4} />
                </View>
                <VStack>
                  <Text className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                    Planner
                  </Text>
                  <Text className="text-lg font-bold text-gray-900">{visibleMonthLabel}</Text>
                </VStack>
              </HStack>

              <TouchableOpacity
                onPress={handleTodayPress}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5"
              >
                <Text className="text-xs font-semibold text-emerald-700">Today</Text>
              </TouchableOpacity>
            </HStack>

            <Text className="text-xs text-gray-500 px-1 pb-3">
              {selectedDateLabel} selected
            </Text>

            <Calendar
              current={selectedDate}
              hideExtraDays={false}
              enableSwipeMonths={true}
              markingType="dot"
              markedDates={calendarMarkedDates}
              onMonthChange={handleMonthChange}
              dayComponent={renderCalendarDay}
              renderArrow={direction =>
                direction === 'left' ? (
                  <ChevronLeft size={18} color="#059669" strokeWidth={2.4} />
                ) : (
                  <ChevronRight size={18} color="#059669" strokeWidth={2.4} />
                )
              }
              style={styles.calendar}
              theme={{
                calendarBackground: '#FFFFFF',
                monthTextColor: '#111827',
                textSectionTitleColor: '#6B7280',
                textDayFontWeight: '600',
                textDayHeaderFontWeight: '700',
                textMonthFontWeight: '800',
                textMonthFontSize: 17,
                textDayFontSize: 14,
                textDayHeaderFontSize: 12,
                dayTextColor: '#111827',
                textDisabledColor: '#D1D5DB',
                arrowColor: '#059669',
                selectedDotColor: '#FFFFFF',
                todayTextColor: '#047857',
              }}
            />
          </View>

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
                  onPress={() => navigation.navigate('HabitCreation' as any)}
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
                    onPress={() => navigation.navigate('HabitCreation' as any)}
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

          <VStack className="w-full bg-white rounded-2xl p-4 border border-gray-200 gap-3">
            <HStack className="flex items-center gap-2">
              <View className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                <Apple size={18} stroke="#059669" strokeWidth={2.5} />
              </View>
              <Text size="xl" className="font-semibold text-gray-900">
                Food for {selectedDateLabel}
              </Text>
            </HStack>

            <HStack className="gap-1.5 mb-4">
              {dailyMacroSummaryItems.map(item => (
                <View
                  key={item.label}
                  className={`flex-1 rounded-xl py-2 px-1 items-center ${
                    item.green
                      ? 'bg-emerald-50 border border-emerald-100'
                      : 'bg-gray-50 border border-gray-100'
                  }`}
                >
                  <Text className={`text-sm font-semibold ${item.green ? 'text-emerald-600' : 'text-gray-900'}`}>
                    {item.value}
                  </Text>
                  <Text className="text-[10px] text-gray-400 mt-0.5">{item.label}</Text>
                </View>
              ))}
            </HStack>

            {foodLogs.length === 0 ? (
              <View className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                <Text className="text-base font-semibold text-gray-900 mb-1">
                  No food logged
                </Text>
                <Text
                  className={`text-sm text-gray-600 ${canLogFoodForSelectedDate ? 'mb-3' : ''}`}
                >
                  {canLogFoodForSelectedDate
                    ? 'Add meals to see calories and macros for this date.'
                    : 'Food can only be logged for today.'}
                </Text>
                {canLogFoodForSelectedDate ? (
                  <TouchableOpacity
                    onPress={handleLogFoodPress}
                    className="self-start rounded-lg bg-blue-600 px-4 py-2"
                  >
                    <Text className="text-white font-semibold">Log Food</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <>
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
              </>
            )}

            <Divider className="h-[1px] bg-gray-200" />

            <VStack className="gap-2">
              <HStack className="items-center gap-1.5 mb-2">
                <View className="w-[5px] h-[5px] rounded-full bg-emerald-600" />
                <Text className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">
                  Logged
                </Text>
              </HStack>

              {loggedMealItems.length === 0 ? (
                <Text className="text-sm text-gray-500">No meals logged for this date.</Text>
              ) : (
                <View className="flex-row flex-wrap gap-2 mb-3">
                  {loggedMealItems.map(slot => {
                    const mealFoods = normalizedMeals[slot.key] || [];
                    const mealProt = mealFoods.reduce((s, f) => s + (f.protein || 0), 0);
                    const mealCarbs = mealFoods.reduce((s, f) => s + (f.carbs || 0), 0);
                    const mealFat = mealFoods.reduce((s, f) => s + (f.fat || 0), 0);
                    const isExpanded = expandedMeal === slot.key;

                    return (
                      <TouchableOpacity
                      key={`logged-${slot.key}`}
                      activeOpacity={0.85}
                      onPress={() => toggleMeal(slot.key)}
                      className={`w-[48%] rounded-xl bg-emerald-50 p-3 ${
                        isExpanded
                          ? 'border-[1.5px] border-emerald-500'
                          : 'border border-emerald-100'
                      }`}
                    >
                      <HStack className="justify-between items-center mb-2">
                        <View className="w-[7px] h-[7px] rounded-full bg-emerald-600" />
                        <View className="rounded-full bg-emerald-100 px-2 py-0.5">
                          <Text className="text-[10px] font-medium text-emerald-600">
                            {slot.count} item{slot.count === 1 ? '' : 's'}
                          </Text>
                        </View>
                      </HStack>
                      <Text className="text-[13px] font-semibold text-gray-900">{slot.label}</Text>

                      <HStack className="gap-2 mt-1.5">
                        <Text className="text-[10px] text-gray-500">
                          P <Text className="text-emerald-600 font-medium">{Math.round(mealProt)}g</Text>
                        </Text>
                        <Text className="text-[10px] text-gray-500">
                          C <Text className="text-emerald-600 font-medium">{Math.round(mealCarbs)}g</Text>
                        </Text>
                        <Text className="text-[10px] text-gray-500">
                          F <Text className="text-emerald-600 font-medium">{Math.round(mealFat)}g</Text>
                        </Text>
                      </HStack>

                      <HStack className="items-center gap-1 mt-1.5">
                        <ChevronRight size={9} color="#9ca3af" strokeWidth={2} />
                        <Text className="text-[10px] text-gray-400">
                          {isExpanded ? 'Tap to close' : 'Tap to view'}
                        </Text>
                      </HStack>
                    </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </VStack>

            {expandedMealDetails ? (
              <View className="rounded-2xl border border-emerald-100 overflow-hidden mb-3">
                <View className="bg-emerald-50 px-3.5 py-2.5 border-b border-emerald-100">
                  <Text className="text-[13px] font-semibold text-emerald-700">
                    {expandedMealDetails.slotLabel} breakdown
                  </Text>
                </View>

                <HStack className="border-b border-gray-100">
                  {expandedMealDetails.macroItems.map((m, i, arr) => (
                    <View
                      key={m.label}
                      className={`flex-1 items-center py-2.5 ${i < arr.length - 1 ? 'border-r border-gray-100' : ''}`}
                    >
                      <Text className="text-sm font-semibold text-gray-900">{m.value}</Text>
                      <Text className="text-[10px] text-gray-400 mt-0.5">{m.label}</Text>
                    </View>
                  ))}
                </HStack>

                {expandedMealDetails.mealFoods.map((food, index) => (
                  <View
                    key={food.id}
                    className={`px-3.5 py-2.5 ${index < expandedMealDetails.mealFoods.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    <HStack className="justify-between items-start">
                      <Text className="text-[13px] text-gray-900 flex-1 mr-2">{food.name}</Text>
                      <Text className="text-[12px] text-gray-400">{Math.round(food.calories || 0)} cal</Text>
                    </HStack>
                    <HStack className="gap-3 mt-1">
                      <Text className="text-[10px] text-gray-400">
                        P <Text className="text-gray-600 font-medium">{Math.round(food.protein || 0)}g</Text>
                      </Text>
                      <Text className="text-[10px] text-gray-400">
                        C <Text className="text-gray-600 font-medium">{Math.round(food.carbs || 0)}g</Text>
                      </Text>
                      <Text className="text-[10px] text-gray-400">
                        F <Text className="text-gray-600 font-medium">{Math.round(food.fat || 0)}g</Text>
                      </Text>
                    </HStack>
                  </View>
                ))}
              </View>
            ) : null}

            <VStack className="gap-2">
              <HStack className="items-center gap-1.5 mb-2">
                <View className="w-[5px] h-[5px] rounded-full bg-red-300" />
                <Text className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">
                  {missingMealLabel}
                </Text>
              </HStack>

              {missingMealItems.length === 0 ? (
                <Text className="text-sm text-gray-500">No missed meals.</Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {missingMealItems.map(slot => (
                    <View
                      key={`missing-${slot.key}`}
                      className="w-[48%] rounded-xl bg-gray-50 border border-gray-100 p-3"
                    >
                      <HStack className="justify-between items-center mb-2">
                        <View className="w-[7px] h-[7px] rounded-full border border-red-300" />
                      </HStack>
                      <Text className="text-[13px] font-semibold text-gray-400">{slot.label}</Text>
                      <Text className="text-[10px] font-medium text-rose-400 mt-1">
                        {isPastSelectedDate ? 'Missed' : 'Not logged'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </VStack>
          </VStack>
        </VStack>
      </ScrollView>

      {isSelectedDateToday ? (
        <Drawer
          isOpen={showDrawer}
          size="lg"
          anchor="bottom"
          onClose={() => setShowDrawer(false)}
        >
          <DrawerBackdrop className="bg-black/40" />

          <DrawerContent className="p-0 rounded-t-3xl bg-white">
            <DrawerHeader className="p-6 border-b border-gray-200 pb-3">
              <Text size="xl" className="font-bold text-gray-900">
                {selectedDate ? formatDate(selectedDate) : 'Select a date'}
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
      ) : null}
    </View>
  );
};

export default DashBoardScreen;
