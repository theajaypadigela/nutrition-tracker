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
import {
  FULL_SCREEN_ACTION_IDS,
  IOS_NOTIFICATION_CATEGORIES,
  NOTIFICATION_ACTION_IDS,
  NOTIFICATION_CHANNEL_IDS,
  NOTIFICATION_IDS,
} from '../app/notifications/contracts';
import {
  MEAL_SCHEDULE_OWNER_STORAGE_KEY,
  MEAL_SCHEDULE_STORAGE_KEY,
} from '../shared/storage/keys';

const MEAL_CALL_CHANNEL_ID = NOTIFICATION_CHANNEL_IDS.mealCall;
const MEAL_DAILY_NOTIFICATION_ID = NOTIFICATION_IDS.mealDaily;
const MEAL_RESCHEDULE_NOTIFICATION_ID = NOTIFICATION_IDS.mealReschedule;

export type MealReminder = {
  hour: number;
  minute: number;
  enabled: boolean;
};

// Keep MealSlot as alias for backward compat with screens
export type MealSlot = MealReminder;

const STORAGE_KEY = MEAL_SCHEDULE_STORAGE_KEY;

// ─── Persist schedule ────────────────────────────────────────────────────────

export async function saveSchedule(
  reminder: MealReminder,
  userId: string,
): Promise<void> {
  const persistedReminder: MealReminder = {
    hour: reminder.hour,
    minute: reminder.minute,
    enabled: reminder.enabled,
  };

  await Promise.all([
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persistedReminder)),
    AsyncStorage.setItem(MEAL_SCHEDULE_OWNER_STORAGE_KEY, userId),
  ]);
}

export async function loadSchedule(userId: string): Promise<MealReminder> {
  const [raw, ownerId] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEY),
    AsyncStorage.getItem(MEAL_SCHEDULE_OWNER_STORAGE_KEY),
  ]);
  if (!raw) return defaultSchedule();

  if (ownerId && ownerId !== userId) {
    return defaultSchedule();
  }

  try {
    const stored = JSON.parse(raw) as MealReminder;

    // Claim the legacy, unscoped value for the first user who opens it after
    // the ownership migration. Subsequent account switches cannot reuse it.
    if (!ownerId) {
      await AsyncStorage.setItem(MEAL_SCHEDULE_OWNER_STORAGE_KEY, userId);
    }

    return {
      hour: stored.hour,
      minute: stored.minute,
      enabled: stored.enabled,
    };
  } catch {
    return defaultSchedule();
  }
}

export function defaultSchedule(): MealReminder {
  return { hour: 20, minute: 0, enabled: false };
}

// ─── Schedule the single daily alarm using Notifee ───────────────────────────

export async function scheduleAllAlarms(
  reminder: MealReminder,
  userId: string,
): Promise<void> {
  await cancelAllMealAlarms();

  if (!reminder.enabled) return;
  await scheduleSingleAlarm(reminder, userId);
}

export async function scheduleSingleAlarm(
  reminder: MealReminder,
  userId: string,
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
      data: {
        userId,
        mealSlotId: 'daily',
        screen: 'IncomingMealCall',
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
          id: FULL_SCREEN_ACTION_IDS.meal,
          launchActivity: 'default',
        },
        pressAction: {
          id: NOTIFICATION_ACTION_IDS.default,
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
        sound: 'default',
        // Call-style vibration pattern: vibrate-pause-vibrate-pause
        vibrationPattern: [1000, 500, 1000, 500],
      },
      ios: {
        sound: 'default',
        interruptionLevel: 'timeSensitive',
        categoryId: IOS_NOTIFICATION_CATEGORIES.mealCall,
      },
    },
    trigger,
  );
}

export async function scheduleMealReschedule(
  delayMinutes: number,
  userId: string,
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
        userId,
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
          id: FULL_SCREEN_ACTION_IDS.meal,
          launchActivity: 'default',
        },
        pressAction: {
          id: NOTIFICATION_ACTION_IDS.default,
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
        sound: 'default',
        vibrationPattern: [1000, 500, 1000, 500],
      },
      ios: {
        sound: 'default',
        interruptionLevel: 'timeSensitive',
        categoryId: IOS_NOTIFICATION_CATEGORIES.mealCall,
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

export async function cancelDisplayedMealNotifications(): Promise<void> {
  await Promise.all([
    notifee.cancelDisplayedNotification(MEAL_DAILY_NOTIFICATION_ID),
    notifee.cancelDisplayedNotification(MEAL_RESCHEDULE_NOTIFICATION_ID),
  ]);
}
