import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { habitApi } from '../services/api/habitApi';
import { scheduleHabitReminder } from '../services/habitScheduler';
import { requestReminderPermissions } from '../services/notifications/reminderService';
import { formatReminderTime } from '../utils/timeFormatter';
import {
  DayKey,
  getRepeatSummary,
  toggleAllDays,
  toggleDay as toggleDayPure,
  toggleWeekdays,
  toggleWeekends,
} from '../utils/daySelection';

export type ReminderType = 'notification' | 'call' | 'none';

const REMINDER_NOTIFICATION: ReminderType = 'notification';
const REMINDER_CALL: ReminderType = 'call';

const extractError = (err: any): string =>
  err?.response?.data?.message ||
  err?.message ||
  'An unexpected error occurred';

/**
 * Form controller for habit creation: name/days/time/reminder-type state, the day-selection
 * quick-picks, and the save flow (permission check -> create via habitApi -> schedule ->
 * onSaved). Navigation stays in the screen via the onSaved callback.
 */
export function useHabitCreationForm(onSaved: () => void) {
  const [habitName, setHabitName] = useState('');
  const [selectedDays, setSelectedDays] = useState<DayKey[]>([]);
  const [reminderType, setReminderType] =
    useState<ReminderType>('notification');
  const [reminderTime, setReminderTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = useCallback((day: DayKey) => {
    setSelectedDays(prev => toggleDayPure(prev, day));
  }, []);
  const selectAllDays = useCallback(() => {
    setSelectedDays(prev => toggleAllDays(prev));
  }, []);
  const selectWeekdays = useCallback(() => {
    setSelectedDays(prev => toggleWeekdays(prev));
  }, []);
  const selectWeekends = useCallback(() => {
    setSelectedDays(prev => toggleWeekends(prev));
  }, []);

  const onTimeChange = useCallback((_event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selectedTime) {
      setReminderTime(selectedTime);
    }
  }, []);

  const repeatSummary = getRepeatSummary(selectedDays);

  const isFormValid =
    habitName.trim().length > 0 &&
    selectedDays.length > 0 &&
    reminderType.length > 0 &&
    reminderTime instanceof Date;

  const handleSave = useCallback(async () => {
    if (!isFormValid) return;

    const wantsReminder =
      reminderType === REMINDER_NOTIFICATION || reminderType === REMINDER_CALL;

    // A habit that wants a reminder must check notification permission; a denial is flagged
    // (the habit is still created — reconciliation arms it once permission is granted).
    if (wantsReminder) {
      const snapshot = await requestReminderPermissions();
      if (!snapshot.notificationsAuthorized) {
        Alert.alert(
          'Notifications are off',
          'This habit reminder won’t be delivered until you enable notifications in Settings. You can fix this from Profile → Reminder health.',
        );
      }
    }

    setError(null);
    setSaving(true);
    try {
      const createdHabit = await habitApi.create({
        name: habitName.trim(),
        repeatDays: selectedDays,
        reminderTime: formatReminderTime(reminderTime),
        reminderType,
      });

      // Re-arm reminders from server truth (idempotent). Surface scheduling failures.
      if (createdHabit && wantsReminder) {
        try {
          await scheduleHabitReminder({
            id: String(createdHabit.id),
            name: createdHabit.name,
            reminderTime: formatReminderTime(reminderTime),
            reminderType: reminderType as 'notification' | 'call',
            completed: false,
            repeatDays: selectedDays,
          });
        } catch (scheduleErr) {
          console.error('Failed to schedule habit reminder:', scheduleErr);
          Alert.alert(
            'Reminder not scheduled',
            'The habit was saved, but its reminder could not be scheduled. Open the habit again to retry.',
          );
        }
      }

      onSaved();
    } catch (err) {
      setError(extractError(err));
      console.error('Failed to create habit:', err);
      Alert.alert(
        'Could not create habit',
        'Something went wrong saving this habit. Please check your connection and try again.',
      );
    } finally {
      setSaving(false);
    }
  }, [
    isFormValid,
    reminderType,
    habitName,
    selectedDays,
    reminderTime,
    onSaved,
  ]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setHabitName('');
    setSelectedDays([]);
    setReminderType('notification');
    setReminderTime(new Date());
    setShowTimePicker(false);
    setError(null);
    setRefreshing(false);
  }, []);

  return {
    habitName,
    setHabitName,
    selectedDays,
    reminderType,
    setReminderType,
    reminderTime,
    showTimePicker,
    setShowTimePicker,
    refreshing,
    saving,
    error,
    repeatSummary,
    isFormValid,
    toggleDay,
    selectAllDays,
    selectWeekdays,
    selectWeekends,
    onTimeChange,
    handleSave,
    handleRefresh,
  };
}
