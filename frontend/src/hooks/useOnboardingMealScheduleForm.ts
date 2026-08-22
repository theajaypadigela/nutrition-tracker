import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import {
  defaultMealSchedule,
  saveMealSchedule,
} from '../services/notifications/reminderService';
import { formatLocaleTimeFromParts } from '../utils/timeFormatter';

export interface UseOnboardingMealScheduleFormOptions {
  /**
   * Called once the call time is saved, with the formatted time to show on the
   * Done screen. Navigation stays in the screen.
   */
  onSaved: (callTime: string) => void;
}

/**
 * Form controller for the one-time "when should we call you?" step: the picked
 * hour/minute, whether the user has picked at all, the notification-permission
 * prompt and the save.
 *
 * The first press of the primary button opens the picker rather than saving —
 * that is deliberate, it is how an unpicked default avoids being saved silently.
 */
export function useOnboardingMealScheduleForm(
  options: UseOnboardingMealScheduleFormOptions,
) {
  const { onSaved } = options;
  const base = defaultMealSchedule();

  const [hour, setHour] = useState(base.hour);
  const [minute, setMinute] = useState(base.minute);
  const [hasPicked, setHasPicked] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const openPicker = useCallback(() => setShowPicker(true), []);

  const onTimeChange = useCallback(
    (event: { type?: string }, selected?: Date) => {
      setShowPicker(false);
      if (event.type === 'dismissed') return;
      if (selected) {
        setHour(selected.getHours());
        setMinute(selected.getMinutes());
        setHasPicked(true);
      }
    },
    [],
  );

  const submit = useCallback(async () => {
    if (!hasPicked) {
      setShowPicker(true);
      return;
    }
    setSaving(true);
    try {
      const settings = await notifee.requestPermission();
      const denied =
        settings.authorizationStatus === AuthorizationStatus.DENIED;
      await saveMealSchedule({ hour, minute, enabled: true });
      if (denied) {
        Alert.alert(
          'Reminders are off',
          'Your call time is saved, but it can’t ring until you enable notifications. You can fix this anytime from Profile → Reminder health.',
        );
      }
      onSaved(formatLocaleTimeFromParts(hour, minute));
    } finally {
      setSaving(false);
    }
  }, [hasPicked, hour, minute, onSaved]);

  /** The DateTimePicker's controlled value for the currently selected time. */
  const pickerValue = (() => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    return d;
  })();

  return {
    hour,
    minute,
    hasPicked,
    showPicker,
    saving,
    pickerValue,
    /** "8:00 PM" for the currently selected time. */
    formattedTime: formatLocaleTimeFromParts(hour, minute),
    openPicker,
    onTimeChange,
    submit,
  };
}
