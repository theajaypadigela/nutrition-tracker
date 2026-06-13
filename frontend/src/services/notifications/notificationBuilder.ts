/**
 * Builds Notifee notification objects + triggers for the two reminder families.
 * Platform-guarded: Android-only options never leak into the iOS payload and vice
 * versa. The arming itself lives in scheduler.ts; this module is the payload factory.
 *
 * AlarmType choice (Android), justified:
 *  - Call reminders are alarm-grade. With exact-alarm granted we use SET_ALARM_CLOCK —
 *    the strongest semantics: exact even in deep Doze, exempt from the ~1-per-9-minute
 *    while-idle throttle, and it surfaces the lockscreen alarm icon so the user knows a
 *    call is queued. This is what makes a meal/habit call behave like a clock alarm.
 *  - Push reminders use SET_EXACT_AND_ALLOW_WHILE_IDLE (exact, Doze-tolerant, but no
 *    alarm-clock UI).
 *  - Without exact-alarm grant, both fall back to SET_AND_ALLOW_WHILE_IDLE (inexact;
 *    the OS batches it, "a few minutes late") and the UI surfaces the degraded state.
 */

import {
  TriggerType,
  TimestampTrigger,
  RepeatFrequency,
  AndroidImportance,
  AndroidCategory,
  AndroidVisibility,
  AlarmType,
  Notification,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import {
  MEAL_CALL_CHANNEL_ID,
  HABIT_CALL_CHANNEL_ID,
  HABIT_PUSH_CHANNEL_ID,
  MISSED_CHANNEL_ID,
} from './channels';

export type ReminderKind = 'meal-call' | 'habit-call' | 'habit-push';

export type RepeatMode = 'none' | 'daily' | 'weekly';

export type BuildCallInput = {
  id: string;
  kind: ReminderKind;
  /** Epoch (ms) this occurrence is intended to fire. Embedded in data for staleness checks. */
  intendedFireAt: number;
  /** Canonical slot key (24h "HH:MM") so the handler can re-arm the right slot. */
  slotKey?: string;
  /** Habit metadata for habit reminders. */
  habit?: { habitId?: string; habitName?: string; habitTime?: string };
  /** Whether this is a one-shot reschedule ("call me back in 20m"). */
  isReschedule?: boolean;
};

const CALL_VIBRATION_PATTERN = [1000, 500, 1000, 500];

function callTitle(kind: ReminderKind, habitName?: string): string {
  if (kind === 'meal-call') return 'AI Nutrition Assistant';
  if (kind === 'habit-call') return 'AI Habit Assistant';
  return habitName ? `Habit Reminder: ${habitName}` : 'Habit Reminder';
}

/**
 * Builds the notification object for a call/push reminder occurrence. `screen` in data
 * drives event routing; `intendedFireAt` drives staleness classification at fire time.
 */
export function buildReminderNotification(input: BuildCallInput): Notification {
  const isCall = input.kind === 'meal-call' || input.kind === 'habit-call';
  const isMeal = input.kind === 'meal-call';

  const data: Record<string, string> = {
    screen: isMeal ? 'IncomingMealCall' : isCall ? 'IncomingHabitCall' : 'Habits',
    reminderKind: input.kind,
    intendedFireAt: String(input.intendedFireAt),
  };
  if (input.slotKey) data.slotKey = input.slotKey;
  if (input.isReschedule) data.isRescheduled = 'true';
  if (isMeal) data.mealSlotId = input.isReschedule ? 'rescheduled' : 'daily';
  if (input.habit?.habitId) data.habitId = input.habit.habitId;
  if (input.habit?.habitName) data.habitName = input.habit.habitName;
  if (input.habit?.habitTime) data.habitTime = input.habit.habitTime;

  const notification: Notification = {
    id: input.id,
    title: callTitle(input.kind, input.habit?.habitName),
    body: isCall
      ? 'Incoming voice call'
      : input.habit?.habitName
        ? `Time for your habit: ${input.habit.habitName}`
        : 'Habit reminder',
    data,
    android: {
      channelId: isMeal
        ? MEAL_CALL_CHANNEL_ID
        : isCall
          ? HABIT_CALL_CHANNEL_ID
          : HABIT_PUSH_CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default',
      vibrationPattern: CALL_VIBRATION_PATTERN,
      pressAction: { id: 'default', launchActivity: 'default' },
      ...(isCall
        ? {
            category: AndroidCategory.CALL,
            lightUpScreen: true,
            ongoing: true,
            loopSound: true,
            autoCancel: false,
            showTimestamp: false,
            timeoutAfter: 60_000,
            fullScreenAction: {
              id: isMeal ? 'meal-fullscreen' : 'habit-fullscreen',
              launchActivity: 'default',
            },
            actions: [
              {
                title: 'Accept',
                pressAction: { id: 'accept', launchActivity: 'default' },
              },
              { title: 'Decline', pressAction: { id: 'decline' } },
            ],
          }
        : {}),
    },
    ios: {
      sound: 'default',
      interruptionLevel: 'timeSensitive',
      // categoryId enables Accept/Decline action buttons on iOS (registered in iosCategories.ts).
      ...(isCall ? { categoryId: isMeal ? 'meal-call' : 'habit-call' } : {}),
      // Foreground presentation:
      //  - Calls suppress the OS banner/sound so they don't duplicate the in-app call takeover
      //    (§G) — the foreground handler shows the in-app banner instead.
      //  - Push reminders (habit 'notification') have NO in-app replacement, so they MUST be
      //    presented by the OS in the foreground; suppressing them here made habit-push silently
      //    invisible whenever the app was open (the foreground handler early-returns for
      //    non-calls). Present a normal heads-up banner + sound for them.
      foregroundPresentationOptions: isCall
        ? { banner: false, list: false, sound: false, badge: true }
        : { banner: true, list: true, sound: true, badge: true },
    },
  };

  return notification;
}

export type BuildTriggerInput = {
  fireAt: number;
  repeat: RepeatMode;
  /** Whether the system grants exact alarms; false => inexact fallback. */
  exact: boolean;
  /** Call reminders get SET_ALARM_CLOCK when exact; push reminders get SET_EXACT. */
  isCall: boolean;
};

export function buildTrigger(input: BuildTriggerInput): TimestampTrigger {
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: input.fireAt,
  };

  if (input.repeat === 'daily') {
    trigger.repeatFrequency = RepeatFrequency.DAILY;
  } else if (input.repeat === 'weekly') {
    trigger.repeatFrequency = RepeatFrequency.WEEKLY;
  }

  if (Platform.OS === 'android') {
    let type: AlarmType;
    if (!input.exact) {
      type = AlarmType.SET_AND_ALLOW_WHILE_IDLE; // inexact, Doze-tolerant fallback
    } else if (input.isCall) {
      type = AlarmType.SET_ALARM_CLOCK; // strongest: alarm-clock semantics for calls
    } else {
      type = AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE;
    }
    trigger.alarmManager = { type };
  }

  return trigger;
}

/** Quiet "you missed your reminder" follow-up notification (no full-screen, no loop). */
export function buildMissedFollowUp(input: {
  id: string;
  kind: ReminderKind;
  habit?: { habitId?: string; habitName?: string; habitTime?: string };
  slotKey?: string;
}): Notification {
  const isMeal = input.kind === 'meal-call';
  const label = isMeal
    ? 'You missed your meal call'
    : input.habit?.habitName
      ? `You missed: ${input.habit.habitName}`
      : 'You missed a habit reminder';

  const data: Record<string, string> = {
    screen: isMeal ? 'MissedMeal' : 'MissedHabit',
    reminderKind: input.kind,
    missed: 'true',
  };
  if (input.slotKey) data.slotKey = input.slotKey;
  if (input.habit?.habitId) data.habitId = input.habit.habitId;
  if (input.habit?.habitName) data.habitName = input.habit.habitName;
  if (input.habit?.habitTime) data.habitTime = input.habit.habitTime;

  return {
    id: input.id,
    title: label,
    body: 'Tap to log now or snooze.',
    data,
    android: {
      channelId: MISSED_CHANNEL_ID,
      importance: AndroidImportance.DEFAULT,
      visibility: AndroidVisibility.PUBLIC,
      pressAction: { id: 'default', launchActivity: 'default' },
      smallIcon: 'ic_launcher',
    },
    ios: {
      interruptionLevel: 'active',
    },
  };
}
