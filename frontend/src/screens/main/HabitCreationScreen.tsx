import React from 'react';
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
  Clock,
  Bell,
  Phone,
  Type,
  Repeat,
} from 'lucide-react-native';
import { VStack } from '../../components/ui/vstack';
import { HStack } from '../../components/ui/hstack';
import { Text } from '../../components/ui/text';
import DateTimePicker from '@react-native-community/datetimepicker';
import AppBar from '../../components/AppBar';
import { formatClockTime } from '../../utils/timeFormatter';
import {
  isAllDays,
  isWeekdaysOnly,
  isWeekendsOnly,
} from '../../utils/daySelection';
import { DayCode } from '../../utils/dayCode';
import {
  ReminderType,
  useHabitCreationForm,
} from '../../hooks/useHabitCreationForm';

const IOS_PLATFORM = 'ios';
const REMINDER_NOTIFICATION: ReminderType = 'notification';
const REMINDER_CALL: ReminderType = 'call';

const DAYS: { key: DayCode; label: string }[] = [
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
  const {
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
  } = useHabitCreationForm(() => navigation.goBack());

  const isIOS = Platform.OS === IOS_PLATFORM;

  return (
    <View className="flex-1">
      <AppBar
        title="New Habit"
        subtitle="Build your routine"
        variant="secondary"
        showBackButton
      />

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
                  {repeatSummary}
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
                  isAllDays(selectedDays)
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Text
                  size="xs"
                  className={`font-medium ${
                    isAllDays(selectedDays)
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
                  isWeekdaysOnly(selectedDays)
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Text
                  size="xs"
                  className={`font-medium ${
                    isWeekdaysOnly(selectedDays)
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
                  isWeekendsOnly(selectedDays)
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Text
                  size="xs"
                  className={`font-medium ${
                    isWeekendsOnly(selectedDays)
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
                {formatClockTime(reminderTime)}
              </Text>
              <Clock size={18} color="#9CA3AF" />
            </TouchableOpacity>

            {showTimePicker && (
              <View className="bg-gray-50 rounded-xl overflow-hidden h-[150px]">
                <DateTimePicker
                  value={reminderTime}
                  mode="time"
                  display={isIOS ? 'spinner' : 'default'}
                  onChange={onTimeChange}
                />
                {isIOS && (
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
                onPress={() => setReminderType(REMINDER_NOTIFICATION)}
                className={`rounded-xl p-4 flex-row items-center gap-3 border ${
                  reminderType === REMINDER_NOTIFICATION
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <View
                  className={`w-10 h-10 rounded-full items-center justify-center ${
                    reminderType === REMINDER_NOTIFICATION
                      ? 'bg-emerald-100'
                      : 'bg-gray-200'
                  }`}
                >
                  <Bell
                    size={18}
                    color={
                      reminderType === REMINDER_NOTIFICATION
                        ? '#059669'
                        : '#6B7280'
                    }
                  />
                </View>
                <VStack className="flex-1">
                  <Text
                    className={`font-semibold ${
                      reminderType === REMINDER_NOTIFICATION
                        ? 'text-emerald-800'
                        : 'text-gray-900'
                    }`}
                  >
                    Push Notification
                  </Text>
                  <Text
                    size="xs"
                    className={
                      reminderType === REMINDER_NOTIFICATION
                        ? 'text-emerald-600'
                        : 'text-gray-500'
                    }
                  >
                    Get a notification on your phone
                  </Text>
                </VStack>
                <View
                  className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                    reminderType === REMINDER_NOTIFICATION
                      ? 'border-emerald-500'
                      : 'border-gray-300'
                  }`}
                >
                  {reminderType === REMINDER_NOTIFICATION && (
                    <View className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  )}
                </View>
              </TouchableOpacity>

              {/* Call Option */}
              <TouchableOpacity
                onPress={() => setReminderType(REMINDER_CALL)}
                className={`rounded-xl p-4 flex-row items-center gap-3 border ${
                  reminderType === REMINDER_CALL
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <View
                  className={`w-10 h-10 rounded-full items-center justify-center ${
                    reminderType === REMINDER_CALL ? 'bg-emerald-100' : 'bg-gray-200'
                  }`}
                >
                  <Phone
                    size={18}
                    color={reminderType === REMINDER_CALL ? '#059669' : '#6B7280'}
                  />
                </View>
                <VStack className="flex-1">
                  <Text
                    className={`font-semibold ${
                      reminderType === REMINDER_CALL
                        ? 'text-emerald-800'
                        : 'text-gray-900'
                    }`}
                  >
                    Phone Call
                  </Text>
                  <Text
                    size="xs"
                    className={
                      reminderType === REMINDER_CALL
                        ? 'text-emerald-600'
                        : 'text-gray-500'
                    }
                  >
                    Receive a reminder call
                  </Text>
                </VStack>
                <View
                  className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                    reminderType === REMINDER_CALL
                      ? 'border-emerald-500'
                      : 'border-gray-300'
                  }`}
                >
                  {reminderType === REMINDER_CALL && (
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
                  🔁 {repeatSummary}
                </Text>
              </HStack>
              <HStack className="items-center gap-2">
                <Text size="sm" className="text-emerald-700">
                  ⏰ {formatClockTime(reminderTime)}
                </Text>
              </HStack>
              <HStack className="items-center gap-2">
                <Text size="sm" className="text-emerald-700">
                  {reminderType === 'notification'
                    ? '🔔 Push Notification'
                    : reminderType === REMINDER_CALL
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
          disabled={!isFormValid || saving}
          className={`py-4 rounded-xl items-center ${
            isFormValid && !saving ? 'bg-emerald-500' : 'bg-gray-300'
          }`}
        >
          <Text
            size="lg"
            className={`font-bold ${
              isFormValid && !saving ? 'text-white' : 'text-gray-500'
            }`}
          >
            {saving ? 'Creating...' : 'Create Habit'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default HabitCreationScreen;
