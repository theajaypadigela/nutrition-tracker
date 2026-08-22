import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  Platform,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import {
  MealReminder,
  loadSchedule,
  saveSchedule,
  scheduleAllAlarms,
  defaultSchedule,
} from '../../services/mealScheduler';
import { useAuth } from '../../context/AuthContext';

export default function MealScheduleScreen() {
  const { user } = useAuth();
  const [reminder, setReminder] = useState<MealReminder>(defaultSchedule());
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadSchedule(user.id).then(setReminder);
    }
  }, [user?.id]);

  const requestPermissions = async (): Promise<boolean> => {
    const settings = await notifee.requestPermission();
    if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
      Alert.alert(
        'Permission needed',
        'Please allow notifications so we can remind you to log meals.',
      );
      return false;
    }
    return true;
  };

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
    if (!user?.id) return;
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;
    setSaving(true);
    try {
      await saveSchedule(reminder, user.id);
      await scheduleAllAlarms(reminder, user.id);
      Alert.alert('✅ Saved', 'Your meal reminder has been scheduled.');
    } catch (e: any) {
      console.error('Schedule alarm error:', e);
      Alert.alert('Error', `Could not schedule alarm: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (hour: number, minute: number): string => {
    const d = new Date();
    d.setHours(hour, minute);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Meal Reminder</Text>
      <Text style={styles.subtitle}>
        Set a daily reminder to log your meals by voice. You'll receive an
        incoming call prompt at the scheduled time.
      </Text>

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
              {formatTime(reminder.hour, reminder.minute)}
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
          {saving ? 'Scheduling…' : 'Save Reminders'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faf8' },
  content: { padding: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8, color: '#1a1a1a' },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 28,
    lineHeight: 20,
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
    marginTop: 16,
  },
  saveBtnDisabled: { backgroundColor: '#aaa' },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
