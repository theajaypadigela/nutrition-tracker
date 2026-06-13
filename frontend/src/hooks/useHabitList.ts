import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { Habit } from '../types/types';
import { habitApi } from '../services/api/habitApi';
import { cancelHabitReminder } from '../services/habitScheduler';
import { calculateHabitStats } from '../utils/habitStats';

const flipCompleted = (habits: Habit[], id: string): Habit[] =>
  habits.map(h => (h.id === id ? { ...h, completed: !h.completed } : h));

/**
 * Owns the "today's habits" list: fetching, optimistic toggle, delete-with-rollback,
 * and derived progress. HabitScreen consumes this and stays presentation-only.
 */
export function useHabitList() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Mirror of the committed list so rollback can restore it without relying on a state
  // updater having run (it may not have, by the time an awaited request rejects).
  const habitsRef = useRef<Habit[]>([]);
  useEffect(() => {
    habitsRef.current = habits;
  }, [habits]);

  const fetchHabits = useCallback(async () => {
    setLoading(true);
    try {
      const fetched = await habitApi.getToday();
      setHabits(fetched || []);
    } catch (err) {
      console.error('Error fetching habits:', err);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHabits();
    setRefreshing(false);
  }, [fetchHabits]);

  const toggleHabit = useCallback(async (id: string) => {
    // Optimistic flip; toggle is its own inverse, so roll back by flipping again.
    setHabits(prev => flipCompleted(prev, id));
    try {
      await habitApi.toggle(id);
    } catch (err) {
      setHabits(prev => flipCompleted(prev, id));
      console.error('Error toggling habit:', err);
    }
  }, []);

  const deleteHabit = useCallback(async (id: string) => {
    // Optimistic removal. Delete on the server FIRST, then cancel the local reminder so the
    // server stays the source of truth; roll back and surface an error if the delete fails.
    const previous = habitsRef.current;
    setHabits(prev => prev.filter(h => h.id !== id));
    try {
      await habitApi.remove(id);
      await cancelHabitReminder(id);
    } catch (err) {
      setHabits(previous);
      console.error('Error deleting habit:', err);
      Alert.alert(
        'Could not delete habit',
        'The habit could not be deleted. Please check your connection and try again.',
      );
    }
  }, []);

  const { completedCount, progressPercent } = calculateHabitStats(habits);

  return {
    habits,
    isInitialLoad,
    loading,
    refreshing,
    completedHabits: completedCount,
    progressPercent,
    fetchHabits,
    refresh,
    toggleHabit,
    deleteHabit,
  };
}
