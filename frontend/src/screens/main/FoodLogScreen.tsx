import React, { useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Text } from '../../components/ui/text';
import { MealGroup } from '../../components/food-log/MealGroup';
import { EditFoodDrawer } from '../../components/food-log/EditFoodDrawer';
import { FoodLogHeader } from '../../components/food-log/FoodLogHeader';
import { CheckinCard } from '../../components/food-log/CheckinCard';
import { MacrosCard } from '../../components/food-log/MacrosCard';
import {
  useNavigation,
  useFocusEffect,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Plus, Mic, Clock } from 'lucide-react-native';
import { getTodayLocalDate } from '../../utils/date';
import { formatEpochTime12h } from '../../utils/timeFormatter';
import { useFoodLog } from '../../hooks/useFoodLog';
import { FoodStackParamList } from '../../navigation/FoodStackNavigator';
import { navigateToVoiceMealLog } from '../../navigation/navigationUtils';
import MealReminderSettings from '../../components/food-log/MealReminderSettings';

type FoodLogNavigationProp = StackNavigationProp<FoodStackParamList, 'FoodLog'>;
type FoodLogRouteProp = RouteProp<FoodStackParamList, 'FoodLog'>;

const DAILY_GOALS = { protein: 180, carbs: 250, fat: 70, sugar: 40 };
const TARGET_CALORIES = 2500;

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

const FoodLogScreen = () => {
  const navigation = useNavigation<FoodLogNavigationProp>();
  const route = useRoute<FoodLogRouteProp>();

  const selectedDate = React.useMemo(() => {
    const todayKey = getTodayLocalDate();
    const requestedDate = route.params?.selectedDate;
    if (
      typeof requestedDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ) {
      return todayKey;
    }
    return requestedDate > todayKey ? todayKey : requestedDate;
  }, [route.params?.selectedDate]);

  const {
    meals,
    nutritionTotals,
    refreshing,
    mealRescheduleTime,
    expandedMeal,
    toggleMeal,
    showDrawer,
    selectedFood,
    openEditor,
    closeEditor,
    reload,
    handleRefresh,
    saveFood,
    deleteFood,
  } = useFoodLog(selectedDate);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const handleAdd = useCallback(
    (_mealType: string) => {
      navigation.navigate('ManualFoodLog', { selectedDate });
    },
    [navigation, selectedDate],
  );

  return (
    <View style={styles.root}>
      {/* green gradient header */}
      <FoodLogHeader
        dateLabel={formatDateLabel(selectedDate)}
        consumed={nutritionTotals.calories}
        target={TARGET_CALORIES}
        onBack={() => navigation.goBack()}
      />

      {/* content scrolls up over the header bottom */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* rescheduled call banner */}
        {Boolean(mealRescheduleTime) && (
          <View style={styles.rescheduleBanner}>
            <Clock size={16} color="#D97706" strokeWidth={2} />
            <Text style={styles.rescheduleText}>
              Meal logging call rescheduled for{' '}
              <Text style={styles.rescheduleTime}>
                {formatEpochTime12h(mealRescheduleTime!)}
              </Text>
            </Text>
          </View>
        )}

        {/* AI check-in card */}
        <CheckinCard />

        {/* meal-logging reminder — card variant, with time picker */}
        <MealReminderSettings variant="card" />

        {/* macros card */}
        <MacrosCard
          totals={{
            protein: nutritionTotals.protein,
            carbs: nutritionTotals.carbs,
            fat: nutritionTotals.fat,
            sugar: nutritionTotals.sugar,
          }}
          dailyGoals={DAILY_GOALS}
        />

        {/* meals section header */}
        <View style={styles.mealsHeader}>
          <Text style={styles.mealsTitle}>Today's meals</Text>
          <Text style={styles.mealsCal}>
            {Math.round(nutritionTotals.calories)} / {TARGET_CALORIES} cal
          </Text>
        </View>

        {/* meal groups */}
        <View style={styles.mealList}>
          {Object.entries(meals).map(([mealType, items]) => (
            <MealGroup
              key={mealType}
              mealType={mealType}
              items={items}
              isExpanded={expandedMeal === mealType}
              onToggleExpand={() => toggleMeal(mealType)}
              onEdit={openEditor}
              onDelete={deleteFood}
              onAdd={handleAdd}
            />
          ))}
        </View>
      </ScrollView>

      <EditFoodDrawer
        isOpen={showDrawer}
        onClose={closeEditor}
        onSave={saveFood}
        initialData={selectedFood}
      />

      {/* voice FAB */}
      <TouchableOpacity
        onPress={() => navigateToVoiceMealLog({ selectedDate })}
        style={styles.voiceFab}
        activeOpacity={0.85}
      >
        <Mic size={24} stroke="white" strokeWidth={2.5} />
      </TouchableOpacity>

      {/* add FAB */}
      <TouchableOpacity
        onPress={() => navigation.navigate('ManualFoodLog', { selectedDate })}
        style={styles.addFab}
        activeOpacity={0.85}
      >
        <Plus size={26} stroke="white" strokeWidth={2.4} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#eef2f0',
  },
  scroll: {
    flex: 1,
    marginTop: -44,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 14,
  },
  rescheduleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  rescheduleText: {
    flex: 1,
    fontSize: 13,
    color: '#b45309',
  },
  rescheduleTime: {
    fontWeight: '700',
    color: '#92400e',
  },
  mealsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  mealsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#16241c',
    letterSpacing: -0.1,
  },
  mealsCal: {
    fontSize: 12,
    color: '#8a988f',
    fontWeight: '700',
  },
  mealList: {
    gap: 11,
  },
  voiceFab: {
    position: 'absolute',
    right: 20,
    bottom: Platform.OS === 'ios' ? 180 : 170,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 22,
    elevation: 8,
  },
  addFab: {
    position: 'absolute',
    right: 20,
    bottom: Platform.OS === 'ios' ? 110 : 100,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0f7a3d',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f7a3d',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.42,
    shadowRadius: 22,
    elevation: 8,
  },
});

export default FoodLogScreen;
