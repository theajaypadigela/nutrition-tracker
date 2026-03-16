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

/** Normalizes a time string to a stable key, e.g. "08:30AM" */
function timeSlotKey(timeStr: string): string {
  return timeStr.replace(/\s+/g, '');
}

export async function scheduleHabitReminder(habit: Habit): Promise<void> {
  const isCall = habit.reminderType === 'call';

  // For call-type habits, use a time-based ID so all habits at the same time
  // share one notification. For push-type, keep per-habit IDs.
  const notifId = isCall
    ? `habit-call-${timeSlotKey(habit.reminderTime)}`
    : `habit-${habit.id}`;

  // Cancel any existing notification with this ID
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

  await notifee.createTriggerNotification(
    {
      id: notifId,
      title: isCall ? 'AI Habit Assistant' : `Habit Reminder: ${habit.name}`,
      body: isCall
        ? 'Incoming voice call'
        : `Time for your habit: ${habit.name}`,
      data: {
        // For calls, we don't embed a specific habitId since the VoiceHabitScreen
        // will fetch all pending habits for this time slot.
        ...(isCall
          ? { habitTime: habit.reminderTime }
          : { habitId: habit.id, habitName: habit.name, habitTime: habit.reminderTime }),
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

  // For reschedules of call-type, also use a time-based ID so concurrent
  // rescheduled habits produce only one call.
  const isCall = habit.reminderType === 'call';
  const notifId = isCall
    ? `habit-reschedule-call-${timeSlotKey(habit.reminderTime)}`
    : `habit-reschedule-${habit.id}`;

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

  await notifee.createTriggerNotification(
    {
      id: notifId,
      title: isCall ? 'AI Habit Assistant' : `Habit Reminder: ${habit.name}`,
      body: isCall
        ? 'Incoming voice call'
        : `Rescheduled reminder: ${habit.name}`,
      data: {
        ...(isCall
          ? { habitTime: habit.reminderTime }
          : { habitId: habit.id, habitName: habit.name, habitTime: habit.reminderTime }),
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
  // Cancel per-habit push notification
  await notifee.cancelTriggerNotification(`habit-${habitId}`);
  await notifee.cancelTriggerNotification(`habit-reschedule-${habitId}`);
}

/** Cancel the consolidated call notification for a time slot. */
export async function cancelHabitCallSlot(reminderTime: string): Promise<void> {
  const key = timeSlotKey(reminderTime);
  await notifee.cancelTriggerNotification(`habit-call-${key}`);
  await notifee.cancelTriggerNotification(`habit-reschedule-call-${key}`);
}
