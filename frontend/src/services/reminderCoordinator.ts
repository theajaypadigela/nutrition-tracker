import notifee from '@notifee/react-native';

import { NOTIFICATION_IDS } from '../app/notifications/contracts';
import { habitApi } from '../features/habits/api/habitApi';
import { scheduleHabitReminder } from './habitScheduler';
import { loadSchedule, scheduleSingleAlarm } from './mealScheduler';

let reminderOperationQueue: Promise<void> = Promise.resolve();

const enqueueReminderOperation = <T>(
  operation: () => Promise<T>,
): Promise<T> => {
  const result = reminderOperationQueue.then(operation, operation);
  reminderOperationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
};

const isRecurringHabitNotification = (notificationId: string): boolean =>
  notificationId.startsWith('habit-') &&
  !notificationId.startsWith('habit-reschedule-');

const isOneOffReminder = (notificationId: string): boolean =>
  notificationId === NOTIFICATION_IDS.mealReschedule ||
  notificationId.startsWith('habit-reschedule-');

const rebuildReminders = async (userId: string): Promise<void> => {
  const [habits, mealSchedule] = await Promise.all([
    habitApi.getAll(),
    loadSchedule(userId),
  ]);

  // Fetch succeeds before anything is removed, so a transient API failure does
  // not destroy the user's currently armed reminders.
  const pendingNotifications = await notifee.getTriggerNotifications();
  const reminderIdsToCancel = pendingNotifications.flatMap(
    ({ notification }) => {
      const notificationId = notification.id;
      if (!notificationId) return [];

      if (
        notificationId === NOTIFICATION_IDS.mealDaily ||
        isRecurringHabitNotification(notificationId)
      ) {
        return [notificationId];
      }

      if (
        isOneOffReminder(notificationId) &&
        notification.data?.userId !== userId
      ) {
        return [notificationId];
      }

      return [];
    },
  );

  await Promise.all(
    reminderIdsToCancel.map(notificationId =>
      notifee.cancelTriggerNotification(notificationId),
    ),
  );

  if (mealSchedule.enabled) {
    await scheduleSingleAlarm(mealSchedule, userId);
  }

  for (const habit of habits) {
    await scheduleHabitReminder(habit, userId);
  }
};

export const reconcileReminders = (userId: string): Promise<void> => {
  if (!userId) return Promise.resolve();
  return enqueueReminderOperation(() => rebuildReminders(userId));
};

export const cancelAllReminders = (): Promise<void> =>
  enqueueReminderOperation(() => notifee.cancelAllNotifications());
