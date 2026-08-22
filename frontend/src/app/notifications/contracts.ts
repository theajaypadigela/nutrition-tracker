export const NOTIFICATION_CHANNEL_IDS = {
  mealCall: 'meal-call-v2',
  habitCall: 'habit-call-v1',
  habitPush: 'habit-push-v1',
} as const;

export const NOTIFICATION_IDS = {
  mealDaily: 'meal-alarm-daily',
  mealReschedule: 'meal-reschedule-once',
  habit: (habitId: string): string => `habit-${habitId}`,
  habitWeekday: (habitId: string, weekday: string): string =>
    `habit-${habitId}-${weekday.toLowerCase()}`,
  habitReschedule: (habitId: string): string => `habit-reschedule-${habitId}`,
} as const;

export const NOTIFICATION_ACTION_IDS = {
  default: 'default',
  accept: 'accept',
  decline: 'decline',
} as const;

export const FULL_SCREEN_ACTION_IDS = {
  meal: 'meal-fullscreen',
  habit: 'habit-fullscreen',
} as const;

export const IOS_NOTIFICATION_CATEGORIES = {
  mealCall: 'meal-call',
} as const;

export interface MealCallNotificationPayload {
  kind: 'meal-call';
  userId: string;
  screen: 'IncomingMealCall';
  mealSlotId: string;
  isRescheduled?: string;
  delayMinutes?: string;
}

export interface HabitCallNotificationPayload {
  kind: 'habit-call';
  userId: string;
  screen: 'IncomingHabitCall';
  habitId: string;
  habitName: string;
  habitTime: string;
  reminderType?: string;
}

export type CallNotificationPayload =
  | MealCallNotificationPayload
  | HabitCallNotificationPayload;

export type NotificationNavigationTarget =
  | {
      screen: 'IncomingMealCall';
      params: { mealSlotId: string; autoAccept: false };
    }
  | {
      screen: 'VoiceMealLog';
      params: { mealSlotId: string; autoStart: true };
    }
  | {
      screen: 'IncomingHabitCall';
      params: {
        habitId: string;
        habitName: string;
        habitTime: string;
        autoAccept: false;
      };
    }
  | {
      screen: 'VoiceHabit';
      params: {
        habitId: string;
        habitName: string;
        habitTime: string;
        autoStart: true;
      };
    };

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

export const parseCallNotificationPayload = (
  data: Record<string, unknown> | undefined,
): CallNotificationPayload | null => {
  if (!data) return null;

  if (data.screen === 'IncomingMealCall') {
    const userId = optionalString(data.userId);
    if (!userId) return null;

    return {
      kind: 'meal-call',
      userId,
      screen: 'IncomingMealCall',
      mealSlotId: optionalString(data.mealSlotId) ?? 'daily',
      isRescheduled: optionalString(data.isRescheduled),
      delayMinutes: optionalString(data.delayMinutes),
    };
  }

  if (data.screen === 'IncomingHabitCall') {
    const userId = optionalString(data.userId);
    const habitId = optionalString(data.habitId);
    const habitName = optionalString(data.habitName);
    const habitTime = optionalString(data.habitTime);

    if (!userId || !habitId || !habitName || !habitTime) return null;

    return {
      kind: 'habit-call',
      userId,
      screen: 'IncomingHabitCall',
      habitId,
      habitName,
      habitTime,
      reminderType: optionalString(data.reminderType),
    };
  }

  return null;
};

export const notificationBelongsToUser = (
  payload: CallNotificationPayload,
  currentUserId: string | null | undefined,
): boolean => !!currentUserId && payload.userId === currentUserId;

export const resolveNotificationNavigation = (
  payload: CallNotificationPayload,
  action: 'open' | 'accept',
): NotificationNavigationTarget => {
  if (payload.kind === 'habit-call') {
    const commonParams = {
      habitId: payload.habitId,
      habitName: payload.habitName,
      habitTime: payload.habitTime,
    };

    return action === 'accept'
      ? { screen: 'VoiceHabit', params: { ...commonParams, autoStart: true } }
      : {
          screen: 'IncomingHabitCall',
          params: { ...commonParams, autoAccept: false },
        };
  }

  return action === 'accept'
    ? {
        screen: 'VoiceMealLog',
        params: { mealSlotId: payload.mealSlotId, autoStart: true },
      }
    : {
        screen: 'IncomingMealCall',
        params: { mealSlotId: payload.mealSlotId, autoAccept: false },
      };
};
