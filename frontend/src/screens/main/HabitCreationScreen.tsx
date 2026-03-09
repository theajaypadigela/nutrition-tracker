import React, { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  Clock,
  Bell,
  Phone,
  Type,
  Repeat,
  Sparkles,
} from 'lucide-react-native';
import { VStack } from '../../components/ui/vstack';
import { HStack } from '../../components/ui/hstack';
import { Text } from '../../components/ui/text';
import { Divider } from '../../components/ui/divider';
import DateTimePicker from '@react-native-community/datetimepicker';
import useApi from '../../hooks/useApi';
import { scheduleHabitReminder } from '../../services/habitScheduler';

type DayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
type ReminderType = 'notification' | 'call' | 'none';

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'Mon', label: 'M' },
  { key: 'Tue', label: 'T' },
  { key: 'Wed', label: 'W' },
  { key: 'Thu', label: 'T' },
  { key: 'Fri', label: 'F' },
  { key: 'Sat', label: 'S' },
  { key: 'Sun', label: 'S' },
];

const HabitCreationScreen = () => {
  const navigation = useNavigation();
  const { loading, error, request } = useApi();

  const [habitName, setHabitName] = useState('');
  const [selectedDays, setSelectedDays] = useState<DayKey[]>([]);
  const [reminderType, setReminderType] =
    useState<ReminderType>('notification');
  const [reminderTime, setReminderTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const toggleDay = (day: DayKey) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day],
    );
  };

  const selectAllDays = () => {
    if (selectedDays.length === 7) {
      setSelectedDays([]);
    } else {
      setSelectedDays(DAYS.map(d => d.key));
    }
  };

  const selectWeekdays = () => {
    if (
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].every(d =>
        selectedDays.includes(d as DayKey),
      ) &&
      !['Sat', 'Sun'].some(d => selectedDays.includes(d as DayKey))
    ) {
      setSelectedDays([]);
      return;
    }
    const weekdays: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    setSelectedDays(weekdays);
  };

  const selectWeekends = () => {
    if (
      ['Sat', 'Sun'].every(d => selectedDays.includes(d as DayKey)) &&
      !['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].some(d =>
        selectedDays.includes(d as DayKey),
      )
    ) {
      setSelectedDays([]);
      return;
    }
    const weekends: DayKey[] = ['Sat', 'Sun'];
    setSelectedDays(weekends);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const onTimeChange = (_event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selectedTime) {
      setReminderTime(selectedTime);
    }
  };

  const getRepeatSummary = () => {
    if (selectedDays.length === 0) return 'No days selected';
    if (selectedDays.length === 7) return 'Every day';
    const weekdays: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const weekends: DayKey[] = ['Sat', 'Sun'];
    if (
      weekdays.every(d => selectedDays.includes(d)) &&
      !weekends.some(d => selectedDays.includes(d))
    )
      return 'Weekdays';
    if (
      weekends.every(d => selectedDays.includes(d)) &&
      !weekdays.some(d => selectedDays.includes(d))
    )
      return 'Weekends';
    return selectedDays.join(', ');
  };

  const isFormValid =
    habitName.trim().length > 0 &&
    selectedDays.length > 0 &&
    reminderType.length > 0 &&
    reminderTime instanceof Date;

  const formatTimeToHHMM = date => {
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const handleSave = async () => {
    if (!isFormValid) return;

    const newHabit = {
      name: habitName.trim(),
      repeatDays: selectedDays,
      reminderTime: formatTimeToHHMM(reminderTime),
      reminderType,
    };

    try {
      const createdHabit = await request({
        url: '/habit',
        method: 'POST',
        data: newHabit,
      });

      console.log('Habit created successfully');

      // Schedule notification for this habit
      if (createdHabit) {
        await scheduleHabitReminder({
          id: String(createdHabit.id),
          name: createdHabit.name,
          reminderTime: formatTimeToHHMM(reminderTime),
          reminderType: reminderType as 'notification' | 'call',
          completed: false,
          repeatDays: selectedDays,
        });
      }

      navigation.goBack();
    } catch (err) {
      console.error('Failed to create habit:', err);
      // Error is already set in the useApi hook
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setHabitName('');
    setSelectedDays([]);
    setReminderType('notification');
    setReminderTime(new Date());
    setShowTimePicker(false);
    setRefreshing(false);
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <HStack className="justify-between items-center w-full px-6 pb-4">
        <HStack className="items-center gap-3">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
          >
            <ArrowLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text size="2xl" className="font-bold text-gray-900">
            New Habit
          </Text>
        </HStack>
        <View className="w-10 h-10 rounded-full bg-emerald-50 items-center justify-center">
          <Sparkles size={20} color="#10B981" />
        </View>
      </HStack>
      <Divider className="h-[2px] bg-gray-200" />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <VStack className="p-6 gap-5">
          {/* Habit Name */}
          <VStack className="bg-white rounded-2xl p-5 border border-gray-200 gap-3">
            <HStack className="items-center gap-2.5">
              <View className="w-9 h-9 rounded-full bg-emerald-50 items-center justify-center">
                <Type size={16} color="#059669" />
              </View>
              <Text size="lg" className="font-semibold text-gray-900">
                Habit Name
              </Text>
            </HStack>
            <TextInput
              value={habitName}
              onChangeText={setHabitName}
              placeholder="e.g., Morning Run, Read Books..."
              placeholderTextColor="#9CA3AF"
              className="bg-gray-50 rounded-xl px-4 py-3.5 text-gray-900 text-base border border-gray-200"
            />
          </VStack>

          {/* Repeat Days */}
          <VStack className="bg-white rounded-2xl p-5 border border-gray-200 gap-4">
            <HStack className="items-center gap-2.5">
              <View className="w-9 h-9 rounded-full bg-blue-50 items-center justify-center">
                <Repeat size={16} color="#3B82F6" />
              </View>
              <VStack>
                <Text size="lg" className="font-semibold text-gray-900">
                  Repeat Days
                </Text>
                <Text size="xs" className="text-gray-500">
                  {getRepeatSummary()}
                </Text>
              </VStack>
            </HStack>

            {/* Day Circles */}
            <HStack className="justify-between px-1">
              {DAYS.map(day => {
                const isSelected = selectedDays.includes(day.key);
                return (
                  <TouchableOpacity
                    key={day.key}
                    onPress={() => toggleDay(day.key)}
                    className={`w-11 h-11 rounded-full items-center justify-center ${
                      isSelected
                        ? 'bg-emerald-500'
                        : 'bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <Text
                      size="sm"
                      className={`font-semibold ${
                        isSelected ? 'text-white' : 'text-gray-600'
                      }`}
                    >
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </HStack>

            {/* Quick Select */}
            <HStack className="gap-2">
              <TouchableOpacity
                onPress={selectAllDays}
                className={`flex-1 py-2 rounded-lg items-center border ${
                  selectedDays.length === 7
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Text
                  size="xs"
                  className={`font-medium ${
                    selectedDays.length === 7
                      ? 'text-emerald-700'
                      : 'text-gray-600'
                  }`}
                >
                  Every Day
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={selectWeekdays}
                className={`flex-1 py-2 rounded-lg items-center border ${
                  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].every(d =>
                    selectedDays.includes(d as DayKey),
                  ) &&
                  !['Sat', 'Sun'].some(d => selectedDays.includes(d as DayKey))
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Text
                  size="xs"
                  className={`font-medium ${
                    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].every(d =>
                      selectedDays.includes(d as DayKey),
                    ) &&
                    !['Sat', 'Sun'].some(d =>
                      selectedDays.includes(d as DayKey),
                    )
                      ? 'text-emerald-700'
                      : 'text-gray-600'
                  }`}
                >
                  Weekdays
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={selectWeekends}
                className={`flex-1 py-2 rounded-lg items-center border ${
                  ['Sat', 'Sun'].every(d =>
                    selectedDays.includes(d as DayKey),
                  ) &&
                  !['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].some(d =>
                    selectedDays.includes(d as DayKey),
                  )
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Text
                  size="xs"
                  className={`font-medium ${
                    ['Sat', 'Sun'].every(d =>
                      selectedDays.includes(d as DayKey),
                    ) &&
                    !['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].some(d =>
                      selectedDays.includes(d as DayKey),
                    )
                      ? 'text-emerald-700'
                      : 'text-gray-600'
                  }`}
                >
                  Weekends
                </Text>
              </TouchableOpacity>
            </HStack>
          </VStack>

          {/* Reminder Time */}
          <VStack className="bg-white rounded-2xl p-5 border border-gray-200 gap-3">
            <HStack className="items-center gap-2.5">
              <View className="w-9 h-9 rounded-full bg-amber-50 items-center justify-center">
                <Clock size={16} color="#D97706" />
              </View>
              <Text size="lg" className="font-semibold text-gray-900">
                Reminder Time
              </Text>
            </HStack>

            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              className="bg-gray-50 rounded-xl px-4 py-3.5 border border-gray-200 flex-row items-center justify-between"
            >
              <Text size="md" className="text-gray-900 font-medium">
                {formatTime(reminderTime)}
              </Text>
              <Clock size={18} color="#9CA3AF" />
            </TouchableOpacity>

            {showTimePicker && (
              <View className="bg-gray-50 rounded-xl overflow-hidden h-[150px]">
                <DateTimePicker
                  value={reminderTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onTimeChange}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    onPress={() => setShowTimePicker(false)}
                    className="py-2.5 items-center border-t border-gray-200"
                  >
                    <Text className="text-emerald-600 font-semibold">Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </VStack>

          {/* Reminder Type */}
          <VStack className="bg-white rounded-2xl p-5 border border-gray-200 gap-4">
            <HStack className="items-center gap-2.5">
              <View className="w-9 h-9 rounded-full bg-purple-50 items-center justify-center">
                <Bell size={16} color="#7C3AED" />
              </View>
              <Text size="lg" className="font-semibold text-gray-900">
                Reminder Type
              </Text>
            </HStack>

            <VStack className="gap-2.5">
              {/* Notification Option */}
              <TouchableOpacity
                onPress={() => setReminderType('notification')}
                className={`rounded-xl p-4 flex-row items-center gap-3 border ${
                  reminderType === 'notification'
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <View
                  className={`w-10 h-10 rounded-full items-center justify-center ${
                    reminderType === 'notification'
                      ? 'bg-emerald-100'
                      : 'bg-gray-200'
                  }`}
                >
                  <Bell
                    size={18}
                    color={
                      reminderType === 'notification' ? '#059669' : '#6B7280'
                    }
                  />
                </View>
                <VStack className="flex-1">
                  <Text
                    className={`font-semibold ${
                      reminderType === 'notification'
                        ? 'text-emerald-800'
                        : 'text-gray-900'
                    }`}
                  >
                    Push Notification
                  </Text>
                  <Text
                    size="xs"
                    className={
                      reminderType === 'notification'
                        ? 'text-emerald-600'
                        : 'text-gray-500'
                    }
                  >
                    Get a notification on your phone
                  </Text>
                </VStack>
                <View
                  className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                    reminderType === 'notification'
                      ? 'border-emerald-500'
                      : 'border-gray-300'
                  }`}
                >
                  {reminderType === 'notification' && (
                    <View className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  )}
                </View>
              </TouchableOpacity>

              {/* Call Option */}
              <TouchableOpacity
                onPress={() => setReminderType('call')}
                className={`rounded-xl p-4 flex-row items-center gap-3 border ${
                  reminderType === 'call'
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <View
                  className={`w-10 h-10 rounded-full items-center justify-center ${
                    reminderType === 'call' ? 'bg-emerald-100' : 'bg-gray-200'
                  }`}
                >
                  <Phone
                    size={18}
                    color={reminderType === 'call' ? '#059669' : '#6B7280'}
                  />
                </View>
                <VStack className="flex-1">
                  <Text
                    className={`font-semibold ${
                      reminderType === 'call'
                        ? 'text-emerald-800'
                        : 'text-gray-900'
                    }`}
                  >
                    Phone Call
                  </Text>
                  <Text
                    size="xs"
                    className={
                      reminderType === 'call'
                        ? 'text-emerald-600'
                        : 'text-gray-500'
                    }
                  >
                    Receive a reminder call
                  </Text>
                </VStack>
                <View
                  className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                    reminderType === 'call'
                      ? 'border-emerald-500'
                      : 'border-gray-300'
                  }`}
                >
                  {reminderType === 'call' && (
                    <View className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  )}
                </View>
              </TouchableOpacity>
            </VStack>
          </VStack>

          {/* Summary Preview */}
          {isFormValid && (
            <VStack className="bg-emerald-50 rounded-2xl p-5 border border-emerald-200 gap-2">
              <Text size="sm" className="font-semibold text-emerald-800">
                Summary
              </Text>
              <HStack className="items-center gap-2">
                <Text size="sm" className="text-emerald-700">
                  📝 {habitName}
                </Text>
              </HStack>
              <HStack className="items-center gap-2">
                <Text size="sm" className="text-emerald-700">
                  🔁 {getRepeatSummary()}
                </Text>
              </HStack>
              <HStack className="items-center gap-2">
                <Text size="sm" className="text-emerald-700">
                  ⏰ {formatTime(reminderTime)}
                </Text>
              </HStack>
              <HStack className="items-center gap-2">
                <Text size="sm" className="text-emerald-700">
                  {reminderType === 'notification'
                    ? '🔔 Push Notification'
                    : reminderType === 'call'
                      ? '📞 Phone Call'
                      : '🔕 No Reminder'}
                </Text>
              </HStack>
            </VStack>
          )}
          <VStack className="h-20" />
        </VStack>
      </ScrollView>

      {/* Save Button - Fixed at Bottom */}
      <View className="absolute bottom-0 left-0 right-0 px-6 pt-4 pb-8 bg-white border-t border-gray-200">
        {error && (
          <View className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <Text size="sm" className="text-red-700">
              {error}
            </Text>
          </View>
        )}
        <TouchableOpacity
          onPress={handleSave}
          disabled={!isFormValid || loading}
          className={`py-4 rounded-xl items-center ${
            isFormValid && !loading ? 'bg-emerald-500' : 'bg-gray-300'
          }`}
        >
          <Text
            size="lg"
            className={`font-bold ${
              isFormValid && !loading ? 'text-white' : 'text-gray-500'
            }`}
          >
            {loading ? 'Creating...' : 'Create Habit'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default HabitCreationScreen;
