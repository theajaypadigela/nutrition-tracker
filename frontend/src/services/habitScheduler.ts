import notifee, {
  TriggerType,
  TimestampTrigger,
  AndroidImportance,
  AndroidCategory,
  AndroidVisibility,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { Habit } from '../types/types';

const HABIT_CALL_CHANNEL_ID = 'habit-call-v1';
const HABIT_PUSH_CHANNEL_ID = 'habit-push-v1';

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
  // Parse "HH:MM AM/PM" format
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return { hour: 8, minute: 0 };
  }
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hour !== 12) {
    hour += 12;
  }
  if (period === 'AM' && hour === 12) {
    hour = 0;
  }
  return { hour, minute };
}

export async function scheduleHabitReminder(habit: Habit): Promise<void> {
  const notifId = `habit-${habit.id}`;

  // Cancel any existing notification for this habit
  await notifee.cancelTriggerNotification(notifId);

  const { hour, minute } = parseReminderTime(habit.reminderTime);

  const now = new Date();
  const fire = new Date();
  fire.setHours(hour, minute, 0, 0);

  // If the time already passed today, schedule for tomorrow
  if (fire.getTime() <= now.getTime()) {
    fire.setDate(fire.getDate() + 1);
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
        : `Time for your habit: ${habit.name}`,
      data: {
        habitId: habit.id,
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
            id: 'habit-fullscreen',
            launchActivity: 'default',
          },
          actions: [
            {
              title: 'Accept',
              pressAction: { id: 'accept', launchActivity: 'default' },
            },
            { title: 'Decline', pressAction: { id: 'decline' } },
          ],
        }),
        sound: 'default',
        vibrationPattern: [1000, 500, 1000, 500],
        pressAction: { id: 'default', launchActivity: 'default' },
      },
      ios: {
        sound: 'default',
        interruptionLevel: 'timeSensitive',
      },
    },
    trigger,
  );
}

export async function scheduleHabitReschedule(
  habit: Habit,
  rescheduleMinutes: number,
): Promise<boolean> {
  const normalizedDelay = Math.floor(rescheduleMinutes);
  if (!Number.isFinite(normalizedDelay) || normalizedDelay <= 0) {
    return false;
  }

  const notifId = `habit-reschedule-${habit.id}`;

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
        habitId: habit.id,
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
            id: 'habit-fullscreen',
            launchActivity: 'default',
          },
          actions: [
            {
              title: 'Accept',
              pressAction: { id: 'accept', launchActivity: 'default' },
            },
            { title: 'Decline', pressAction: { id: 'decline' } },
          ],
        }),
        sound: 'default',
        vibrationPattern: [1000, 500, 1000, 500],
        pressAction: { id: 'default', launchActivity: 'default' },
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
  await notifee.cancelTriggerNotification(`habit-${habitId}`);
  await notifee.cancelTriggerNotification(`habit-reschedule-${habitId}`);
}
