import notifee, {
  TriggerType,
  TimestampTrigger,
  RepeatFrequency,
  AndroidImportance,
  AndroidCategory,
  AndroidVisibility,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const MEAL_CALL_CHANNEL_ID = 'meal-call-v2';
const MEAL_DAILY_NOTIFICATION_ID = 'meal-alarm-daily';
const MEAL_RESCHEDULE_NOTIFICATION_ID = 'meal-reschedule-once';

export type MealReminder = {
  hour: number;
  minute: number;
  enabled: boolean;
};

// Keep MealSlot as alias for backward compat with screens
export type MealSlot = MealReminder;

const STORAGE_KEY = 'meal_schedule_v2';

// ─── Persist schedule ────────────────────────────────────────────────────────

export async function saveSchedule(reminder: MealReminder): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reminder));
}

export async function loadSchedule(): Promise<MealReminder> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultSchedule();
  return JSON.parse(raw);
}

export function defaultSchedule(): MealReminder {
  return { hour: 20, minute: 0, enabled: false };
}

// ─── Schedule the single daily alarm using Notifee ───────────────────────────

export async function scheduleAllAlarms(reminder: MealReminder): Promise<void> {
  await cancelAllMealAlarms();

  if (!reminder.enabled) return;
  await scheduleSingleAlarm(reminder);
}

export async function scheduleSingleAlarm(
  reminder: MealReminder,
): Promise<void> {
  // Ensure the notification channel exists with call-style settings
  await notifee.createChannel({
    id: MEAL_CALL_CHANNEL_ID,
    name: 'Meal Logging Calls',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    bypassDnd: true,
    vibration: true,
    sound: 'default',
  });

  const now = new Date();
  const fire = new Date();
  fire.setHours(reminder.hour, reminder.minute, 0, 0);

  // If the time already passed today, schedule for tomorrow
  if (fire.getTime() <= now.getTime()) {
    fire.setDate(fire.getDate() + 1);
  }

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: fire.getTime(),
    repeatFrequency: RepeatFrequency.DAILY,
  };

  // Only use alarmManager on Android
  if (Platform.OS === 'android') {
    trigger.alarmManager = {
      allowWhileIdle: true,
    };
  }

  await notifee.createTriggerNotification(
    {
      id: MEAL_DAILY_NOTIFICATION_ID,
      title: 'AI Nutrition Assistant',
      body: 'Incoming voice call',
      data: { mealSlotId: 'daily', screen: 'IncomingMealCall' },
      android: {
        channelId: MEAL_CALL_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        category: AndroidCategory.CALL,
        lightUpScreen: true,
        ongoing: true,
        loopSound: true,
        autoCancel: false,
        showTimestamp: false,
        timeoutAfter: 60_000,
        fullScreenAction: {
          id: 'meal-fullscreen',
          launchActivity: 'default',
        },
        pressAction: { id: 'default', launchActivity: 'default' },
        actions: [
          {
            title: 'Accept',
            pressAction: { id: 'accept', launchActivity: 'default' },
          },
          { title: 'Decline', pressAction: { id: 'decline' } },
        ],
        sound: 'default',
        // Call-style vibration pattern: vibrate-pause-vibrate-pause
        vibrationPattern: [1000, 500, 1000, 500],
      },
      ios: {
        sound: 'default',
        interruptionLevel: 'timeSensitive',
        categoryId: 'meal-call',
      },
    },
    trigger,
  );
}

export async function scheduleMealReschedule(
  delayMinutes: number,
): Promise<boolean> {
  const normalizedDelay = Math.floor(delayMinutes);
  if (!Number.isFinite(normalizedDelay) || normalizedDelay <= 0) {
    return false;
  }

  await notifee.createChannel({
    id: MEAL_CALL_CHANNEL_ID,
    name: 'Meal Logging Calls',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    bypassDnd: true,
    vibration: true,
    sound: 'default',
  });

  await notifee.cancelTriggerNotification(MEAL_RESCHEDULE_NOTIFICATION_ID);

  const now = new Date();
  const fire = new Date(now.getTime() + normalizedDelay * 60 * 1000);

  // Only allow follow-up reminder for the current day.
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
    trigger.alarmManager = {
      allowWhileIdle: true,
    };
  }

  await notifee.createTriggerNotification(
    {
      id: MEAL_RESCHEDULE_NOTIFICATION_ID,
      title: 'AI Nutrition Assistant',
      body: 'Incoming voice call',
      data: {
        mealSlotId: 'rescheduled',
        screen: 'IncomingMealCall',
        isRescheduled: 'true',
        delayMinutes: String(normalizedDelay),
      },
      android: {
        channelId: MEAL_CALL_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        category: AndroidCategory.CALL,
        lightUpScreen: true,
        ongoing: true,
        loopSound: true,
        autoCancel: false,
        showTimestamp: false,
        timeoutAfter: 60_000,
        fullScreenAction: {
          id: 'meal-fullscreen',
          launchActivity: 'default',
        },
        pressAction: { id: 'default', launchActivity: 'default' },
        actions: [
          {
            title: 'Accept',
            pressAction: { id: 'accept', launchActivity: 'default' },
          },
          { title: 'Decline', pressAction: { id: 'decline' } },
        ],
        sound: 'default',
        vibrationPattern: [1000, 500, 1000, 500],
      },
      ios: {
        sound: 'default',
        interruptionLevel: 'timeSensitive',
        categoryId: 'meal-call',
      },
    },
    trigger,
  );

  return true;
}

export async function cancelAllMealAlarms(): Promise<void> {
  await notifee.cancelTriggerNotification(MEAL_DAILY_NOTIFICATION_ID);
  await notifee.cancelTriggerNotification(MEAL_RESCHEDULE_NOTIFICATION_ID);
}
