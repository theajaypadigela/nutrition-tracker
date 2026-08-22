import React from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import AppBar from '../../components/common/AppBar';

import { HStack } from '../../components/ui/hstack';
import { VStack } from '../../components/ui/vstack';
import { Text } from '../../components/ui/text';
import HabitList from '../../components/dashboard/HabitList';
import MealSlotSection from '../../components/dashboard/MealSlotSection';
import DayDetailDrawer from '../../components/dashboard/DayDetailDrawer';

import {
  formatDate,
  getTodayLocalDate,
  parseLocalDateString,
} from '../../utils/date';
import { useDashboard } from '../../hooks/useDashboard';

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
  const todayKey = React.useMemo(() => getTodayLocalDate(), []);
  const [visibleMonthLabel, setVisibleMonthLabel] = React.useState<string>(() => {
    const selected = new Date();
    return selected.toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });
  });

  const {
    selectedDate,
    setSelectedDate,
    refreshing,
    handleRefresh,
    expandedMeal,
    toggleMeal,
    normalizedMeals,
    foodLogs,
    habits,
    completedHabits,
    totalHabits,
    habitProgress,
    completedHabitItems,
    incompleteHabitItems,
    foodTotals,
    dailyMacroSummaryItems,
    loggedMealItems,
    missingMealItems,
    expandedMealDetails,
  } = useDashboard();

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

  const handleDayPress = (day: DateData) => {
    if (day.dateString > todayKey) {
      return;
    }

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
  const isFutureSelectedDate = selectedDate > todayKey;
  const canLogFoodForSelectedDate = !isFutureSelectedDate;

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
        onPress={() => {
          if (!isDisabled) {
            handleDayPress(date);
          }
        }}
        activeOpacity={isDisabled ? 1 : 0.85}
        disabled={isDisabled}
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
    navigation.navigate(
      'Food' as any,
      { screen: 'FoodLog', params: { selectedDate } } as any,
    );
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
              maxDate={todayKey}
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

          <HabitList
            selectedDateLabel={selectedDateLabel}
            isSelectedDateToday={isSelectedDateToday}
            isPastSelectedDate={isPastSelectedDate}
            incompleteHabitLabel={incompleteHabitLabel}
            totalHabits={totalHabits}
            completedHabits={completedHabits}
            habitProgress={habitProgress}
            completedHabitItems={completedHabitItems}
            incompleteHabitItems={incompleteHabitItems}
            onCreateHabit={() => navigation.navigate('HabitCreation' as any)}
          />

          <MealSlotSection
            selectedDateLabel={selectedDateLabel}
            isPastSelectedDate={isPastSelectedDate}
            canLogFoodForSelectedDate={canLogFoodForSelectedDate}
            missingMealLabel={missingMealLabel}
            dailyMacroSummaryItems={dailyMacroSummaryItems}
            foodLogs={foodLogs}
            foodTotals={foodTotals}
            normalizedMeals={normalizedMeals}
            loggedMealItems={loggedMealItems}
            missingMealItems={missingMealItems}
            expandedMeal={expandedMeal}
            onToggleMeal={toggleMeal}
            expandedMealDetails={expandedMealDetails}
            onLogFood={handleLogFoodPress}
          />
        </VStack>
      </ScrollView>

      {isSelectedDateToday ? (
        <DayDetailDrawer
          isOpen={showDrawer}
          onClose={() => setShowDrawer(false)}
          title={selectedDate ? formatDate(selectedDate) : 'Select a date'}
          habits={habits}
          foodTotals={foodTotals}
          foodLogs={foodLogs}
        />
      ) : null}
    </View>
  );
};

export default DashBoardScreen;
