import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
  StyleSheet,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import {
  MealReminder,
  defaultSchedule,
  saveSchedule,
  scheduleAllAlarms,
} from '../../services/mealScheduler';
import notifee, { AuthorizationStatus } from '@notifee/react-native';

export default function OnboardingMealScheduleScreen() {
  const navigation = useNavigation<any>();
  const [reminder, setReminder] = useState<MealReminder>(defaultSchedule());
  const [showPicker, setShowPicker] = useState(false);

  const toggleEnabled = (val: boolean) =>
    setReminder(prev => ({ ...prev, enabled: val }));

  const updateTime = (date: Date) => {
    setReminder(prev => ({
      ...prev,
      hour: date.getHours(),
      minute: date.getMinutes(),
    }));
    setShowPicker(false);
  };

  const formatTime = (h: number, m: number) => {
    const d = new Date();
    d.setHours(h, m);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleContinue = async () => {
    const settings = await notifee.requestPermission();
    if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
      Alert.alert(
        'Tip',
        'You can enable reminders later in Profile → Meal Reminders.',
      );
    }
    await saveSchedule(reminder);
    await scheduleAllAlarms(reminder);
    navigation.replace('MainTabs');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Set Meal Reminder</Text>
      <Text style={styles.subtitle}>
        Set a daily time to get a call-style prompt to log your meals by voice
        with your AI assistant. You can skip this and set it later in Profile.
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
          </TouchableOpacity>
        </View>
        <Switch
          value={reminder.enabled}
          onValueChange={toggleEnabled}
          trackColor={{ false: '#ccc', true: '#81C784' }}
          thumbColor={reminder.enabled ? '#2e7d32' : '#f4f4f4'}
        />
      </View>

      {showPicker &&
        (() => {
          const d = new Date();
          d.setHours(reminder.hour, reminder.minute);
          return (
            <DateTimePicker
              value={d}
              mode="time"
              is24Hour={false}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, sel) => {
                if (sel) updateTime(sel);
                else setShowPicker(false);
              }}
            />
          );
        })()}

      <TouchableOpacity onPress={handleContinue} style={styles.continueBtn}>
        <Text style={styles.continueBtnText}>Continue →</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.replace('MainTabs')}
        style={styles.skipBtn}
      >
        <Text style={styles.skipBtnText}>Skip for now</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faf8' },
  content: { padding: 28 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 8, color: '#1a1a1a' },
  subtitle: { color: '#666', marginBottom: 28, lineHeight: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    elevation: 2,
  },
  cardLeft: { flex: 1 },
  mealLabel: { fontSize: 17, fontWeight: '600', color: '#1a1a1a' },
  timeText: { fontSize: 22, fontWeight: '700', color: '#2e7d32' },
  timeTextDisabled: { color: '#bbb' },
  continueBtn: {
    backgroundColor: '#2e7d32',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  continueBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  skipBtn: { marginTop: 14, alignItems: 'center' },
  skipBtnText: { color: '#999', fontSize: 14 },
});
