import notifee, {
  TriggerType,
  TimestampTrigger,
  RepeatFrequency,
  AndroidImportance,
  AndroidCategory,
  AndroidVisibility,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { Habit } from '../types/types';
import {
  FULL_SCREEN_ACTION_IDS,
  NOTIFICATION_ACTION_IDS,
  NOTIFICATION_CHANNEL_IDS,
  NOTIFICATION_IDS,
} from '../app/notifications/contracts';

const HABIT_CALL_CHANNEL_ID = NOTIFICATION_CHANNEL_IDS.habitCall;
const HABIT_PUSH_CHANNEL_ID = NOTIFICATION_CHANNEL_IDS.habitPush;

const WEEKDAYS = [
  { code: 'SUN', dateIndex: 0 },
  { code: 'MON', dateIndex: 1 },
  { code: 'TUE', dateIndex: 2 },
  { code: 'WED', dateIndex: 3 },
  { code: 'THU', dateIndex: 4 },
  { code: 'FRI', dateIndex: 5 },
  { code: 'SAT', dateIndex: 6 },
] as const;

type WeekdayCode = (typeof WEEKDAYS)[number]['code'];

export async function ensureHabitChannels(): Promise<void> {
  await notifee.createChannel({
    id: HABIT_CALL_CHANNEL_ID,
    name: 'Habit Voice Reminders',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    bypassDnd: true,
    vibration: true,
    sound: 'default',
  });

  await notifee.createChannel({
    id: HABIT_PUSH_CHANNEL_ID,
    name: 'Habit Push Reminders',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    vibration: true,
    sound: 'default',
  });
}

function parseReminderTime(timeStr: string): { hour: number; minute: number } {
  const twelveHourMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const twentyFourHourMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

  if (!twelveHourMatch && !twentyFourHourMatch) {
    return { hour: 8, minute: 0 };
  }

  const match = twelveHourMatch ?? twentyFourHourMatch!;
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);

  if (hour > 23 || minute > 59) {
    return { hour: 8, minute: 0 };
  }

  if (!twelveHourMatch) {
    return { hour, minute };
  }

  if (hour < 1 || hour > 12) {
    return { hour: 8, minute: 0 };
  }

  const period = match[3].toUpperCase();

  if (period === 'PM' && hour !== 12) {
    hour += 12;
  }
  if (period === 'AM' && hour === 12) {
    hour = 0;
  }
  return { hour, minute };
}

const normalizeRepeatDays = (repeatDays: string[] | null | undefined) => {
  const requestedDays = new Set(
    (repeatDays ?? []).map(day => day.slice(0, 3).toUpperCase()),
  );

  return WEEKDAYS.filter(day => requestedDays.has(day.code));
};

const getNextWeeklyFire = (
  now: Date,
  weekdayIndex: number,
  hour: number,
  minute: number,
): Date => {
  const fire = new Date(now);
  const daysUntilTarget = (weekdayIndex - now.getDay() + 7) % 7;
  fire.setDate(now.getDate() + daysUntilTarget);
  fire.setHours(hour, minute, 0, 0);

  if (fire.getTime() <= now.getTime()) {
    fire.setDate(fire.getDate() + 7);
  }

  return fire;
};

const recurringNotificationId = (
  habitId: string,
  day: WeekdayCode,
  index: number,
): string =>
  index === 0
    ? NOTIFICATION_IDS.habit(habitId)
    : NOTIFICATION_IDS.habitWeekday(habitId, day);

export const getHabitRecurringNotificationIds = (habitId: string): string[] => [
  NOTIFICATION_IDS.habit(habitId),
  ...WEEKDAYS.map(day => NOTIFICATION_IDS.habitWeekday(habitId, day.code)),
];

export async function cancelHabitRecurringReminders(
  habitId: string,
): Promise<void> {
  await Promise.all(
    getHabitRecurringNotificationIds(habitId).map(notificationId =>
      notifee.cancelTriggerNotification(notificationId),
    ),
  );
}

export async function scheduleHabitReminder(
  habit: Habit,
  userId: string,
  now = new Date(),
): Promise<void> {
  const habitId = String(habit.id);
  await cancelHabitRecurringReminders(habitId);

  if (habit.reminderType === 'none') return;

  const repeatDays = normalizeRepeatDays(habit.repeatDays);
  if (repeatDays.length === 0) return;

  await ensureHabitChannels();

  const { hour, minute } = parseReminderTime(habit.reminderTime);
  const isCall = habit.reminderType === 'call';

  await Promise.all(
    repeatDays.map(async (day, index) => {
      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: getNextWeeklyFire(
          now,
          day.dateIndex,
          hour,
          minute,
        ).getTime(),
        repeatFrequency: RepeatFrequency.WEEKLY,
      };

      if (Platform.OS === 'android') {
        trigger.alarmManager = { allowWhileIdle: true };
      }

      await notifee.createTriggerNotification(
        {
          id: recurringNotificationId(habitId, day.code, index),
          title: isCall
            ? 'AI Habit Assistant'
            : `Habit Reminder: ${habit.name}`,
          body: isCall
            ? 'Incoming voice call'
            : `Time for your habit: ${habit.name}`,
          data: {
            userId,
            habitId,
            habitName: habit.name,
            habitTime: habit.reminderTime,
            reminderType: habit.reminderType,
            screen: isCall ? 'IncomingHabitCall' : 'Habits',
          },
          android: {
            channelId: isCall ? HABIT_CALL_CHANNEL_ID : HABIT_PUSH_CHANNEL_ID,
            importance: AndroidImportance.HIGH,
            visibility: AndroidVisibility.PUBLIC,
            ...(isCall && {
              category: AndroidCategory.CALL,
              lightUpScreen: true,
              ongoing: true,
              loopSound: true,
              autoCancel: false,
              showTimestamp: false,
              timeoutAfter: 60_000,
              fullScreenAction: {
                id: FULL_SCREEN_ACTION_IDS.habit,
                launchActivity: 'default',
              },
              actions: [
                {
                  title: 'Accept',
                  pressAction: {
                    id: NOTIFICATION_ACTION_IDS.accept,
                    launchActivity: 'default',
                  },
                },
                {
                  title: 'Decline',
                  pressAction: { id: NOTIFICATION_ACTION_IDS.decline },
                },
              ],
            }),
            sound: 'default',
            vibrationPattern: [1000, 500, 1000, 500],
            pressAction: {
              id: NOTIFICATION_ACTION_IDS.default,
              launchActivity: 'default',
            },
          },
          ios: {
            sound: 'default',
            interruptionLevel: 'timeSensitive',
          },
        },
        trigger,
      );
    }),
  );
}

export async function scheduleHabitReschedule(
  habit: Habit,
  rescheduleMinutes: number,
  userId: string,
): Promise<boolean> {
  const normalizedDelay = Math.floor(rescheduleMinutes);
  if (!Number.isFinite(normalizedDelay) || normalizedDelay <= 0) {
    return false;
  }

  const habitId = String(habit.id);
  const notifId = NOTIFICATION_IDS.habitReschedule(habitId);

  await notifee.cancelTriggerNotification(notifId);

  const now = new Date();
  const fire = new Date(now.getTime() + normalizedDelay * 60 * 1000);

  const isSameDay =
    now.getFullYear() === fire.getFullYear() &&
    now.getMonth() === fire.getMonth() &&
    now.getDate() === fire.getDate();

  if (!isSameDay) {
    return false;
  }

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: fire.getTime(),
  };

  if (Platform.OS === 'android') {
    trigger.alarmManager = { allowWhileIdle: true };
  }

  const isCall = habit.reminderType === 'call';

  await notifee.createTriggerNotification(
    {
      id: notifId,
      title: isCall ? 'AI Habit Assistant' : `Habit Reminder: ${habit.name}`,
      body: isCall
        ? 'Incoming voice call'
        : `Rescheduled reminder: ${habit.name}`,
      data: {
        userId,
        habitId,
        habitName: habit.name,
        habitTime: habit.reminderTime,
        reminderType: habit.reminderType,
        screen: isCall ? 'IncomingHabitCall' : 'Habits',
      },
      android: {
        channelId: isCall ? HABIT_CALL_CHANNEL_ID : HABIT_PUSH_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        ...(isCall && {
          category: AndroidCategory.CALL,
          lightUpScreen: true,
          ongoing: true,
          loopSound: true,
          autoCancel: false,
          showTimestamp: false,
          timeoutAfter: 60_000,
          fullScreenAction: {
            id: FULL_SCREEN_ACTION_IDS.habit,
            launchActivity: 'default',
          },
          actions: [
            {
              title: 'Accept',
              pressAction: {
                id: NOTIFICATION_ACTION_IDS.accept,
                launchActivity: 'default',
              },
            },
            {
              title: 'Decline',
              pressAction: { id: NOTIFICATION_ACTION_IDS.decline },
            },
          ],
        }),
        sound: 'default',
        vibrationPattern: [1000, 500, 1000, 500],
        pressAction: {
          id: NOTIFICATION_ACTION_IDS.default,
          launchActivity: 'default',
        },
      },
      ios: {
        sound: 'default',
        interruptionLevel: 'timeSensitive',
      },
    },
    trigger,
  );

  return true;
}

export async function cancelHabitReminder(habitId: string): Promise<void> {
  await Promise.all([
    cancelHabitRecurringReminders(habitId),
    notifee.cancelTriggerNotification(
      NOTIFICATION_IDS.habitReschedule(habitId),
    ),
  ]);
}

export async function cancelDisplayedHabitNotifications(
  habitId: string,
): Promise<void> {
  await Promise.all(
    [
      ...getHabitRecurringNotificationIds(habitId),
      NOTIFICATION_IDS.habitReschedule(habitId),
    ].map(notificationId =>
      notifee.cancelDisplayedNotification(notificationId),
    ),
  );
}
