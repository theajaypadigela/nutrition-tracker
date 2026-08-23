import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Alert,
  StyleProp,
  ViewStyle,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import {
  MealSchedule,
  loadMealScheduleCached,
  saveMealSchedule,
  defaultMealSchedule,
} from '@/services/notifications/reminderService';
import { formatClockTimeFromParts } from '@/utils/timeFormatter';

type Props = {
  /**
   * 'screen' renders the full title + subtitle (standalone Meal Reminders screen).
   * 'card' renders a compact heading suited to embedding inline on the Food Log page.
   */
  variant?: 'screen' | 'card';
  style?: StyleProp<ViewStyle>;
  /** Called after a successful save with the persisted schedule. */
  onSaved?: (schedule: MealSchedule) => void;
};

/**
 * Self-contained meal-reminder controls (time + enable + save). Owns its own load/save
 * lifecycle via the reminder facade, so it can be dropped into any screen without
 * lifting state. Rendered both by MealScheduleScreen and inline on the Food Log page (where
 * users log their meals) — the same controls, one source of truth.
 *
 * Uses a plain View root (NOT a ScrollView) so it nests safely inside the Food Log
 * ScrollView without a nested-VirtualizedList warning.
 */
export default function MealReminderSettings({
  variant = 'screen',
  style,
  onSaved,
}: Props) {
  const [reminder, setReminder] = useState<MealSchedule>(defaultMealSchedule());
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    loadMealScheduleCached().then(s => {
      if (active) setReminder(s);
    });
    return () => {
      active = false;
    };
  }, []);

  const toggleEnabled = (enabled: boolean) => {
    setReminder(prev => ({ ...prev, enabled }));
  };

  const updateTime = (date: Date) => {
    setReminder(prev => ({
      ...prev,
      hour: date.getHours(),
      minute: date.getMinutes(),
    }));
    setShowPicker(false);
  };

  const handleSave = async () => {
    setSaving(true);
    // Schedule-and-flag (unified with onboarding & habit creation): persist the intent
    // regardless, but if the user is enabling a reminder while notifications are denied,
    // flag it — reconciliation arms it and it delivers once permission is granted.
    let notificationsDenied = false;
    if (reminder.enabled) {
      const settings = await notifee.requestPermission();
      notificationsDenied =
        settings.authorizationStatus === AuthorizationStatus.DENIED;
    }
    try {
      await saveMealSchedule(reminder);
      if (notificationsDenied) {
        Alert.alert(
          'Saved — but notifications are off',
          'Your meal reminder is saved, but it can’t ring until you enable notifications. Fix this from Profile → Reminder health.',
        );
      } else {
        Alert.alert('✅ Saved', 'Your meal reminder has been scheduled.');
      }
      onSaved?.(reminder);
    } catch (e: any) {
      console.error('Schedule alarm error:', e);
      Alert.alert('Error', `Could not schedule alarm: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[variant === 'card' && styles.cardContainer, style]}>
      {variant === 'screen' ? (
        <>
          <Text style={styles.title}>Meal Reminder</Text>
          <Text style={styles.subtitle}>
            Set a daily reminder to log your meals by voice. You'll receive an
            incoming call prompt at the scheduled time.
          </Text>
        </>
      ) : (
        <Text style={styles.compactHeading}>Meal logging reminder</Text>
      )}

      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <Text style={styles.mealLabel}>Daily Reminder</Text>
          <TouchableOpacity
            onPress={() => reminder.enabled && setShowPicker(true)}
            disabled={!reminder.enabled}
          >
            <Text
              style={[
                styles.timeText,
                !reminder.enabled && styles.timeTextDisabled,
              ]}
            >
              {formatClockTimeFromParts(reminder.hour, reminder.minute)}
            </Text>
            {reminder.enabled && (
              <Text style={styles.tapToChange}>Tap to change time</Text>
            )}
          </TouchableOpacity>
        </View>
        <Switch
          value={reminder.enabled}
          onValueChange={toggleEnabled}
          trackColor={{ false: '#ccc', true: '#81C784' }}
          thumbColor={reminder.enabled ? '#2e7d32' : '#f4f3f4'}
        />
      </View>

      {showPicker &&
        (() => {
          const date = new Date();
          date.setHours(reminder.hour, reminder.minute);
          return (
            <DateTimePicker
              value={date}
              mode="time"
              is24Hour={false}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, selected) => {
                if (selected) updateTime(selected);
                else setShowPicker(false);
              }}
            />
          );
        })()}

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>
          {saving ? 'Scheduling…' : 'Save Reminder'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#f1f8f1',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7ebd7',
    padding: 16,
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8, color: '#1a1a1a' },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 28,
    lineHeight: 20,
  },
  compactHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2e7d32',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  cardLeft: { flex: 1 },
  mealLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  timeText: { fontSize: 22, fontWeight: '700', color: '#2e7d32' },
  timeTextDisabled: { color: '#bbb' },
  tapToChange: { fontSize: 11, color: '#999', marginTop: 2 },
  saveBtn: {
    backgroundColor: '#2e7d32',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnDisabled: { backgroundColor: '#aaa' },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
