import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { RepeatFrequency, TriggerType } from '@notifee/react-native';

import { NOTIFICATION_IDS } from '../../app/notifications/contracts';
import { habitApi } from '../../features/habits/api/habitApi';
import {
  cancelDisplayedHabitNotifications,
  scheduleHabitReminder,
} from '../habitScheduler';
import {
  cancelDisplayedMealNotifications,
  loadSchedule,
  saveSchedule,
} from '../mealScheduler';
import { reconcileReminders } from '../reminderCoordinator';
import {
  MEAL_SCHEDULE_OWNER_STORAGE_KEY,
  MEAL_SCHEDULE_STORAGE_KEY,
} from '../../shared/storage/keys';

jest.mock('../../features/habits/api/habitApi', () => ({
  habitApi: {
    getAll: jest.fn(),
  },
}));

const notifeeMock = notifee as jest.Mocked<typeof notifee>;
const getAllHabits = habitApi.getAll as jest.MockedFunction<
  typeof habitApi.getAll
>;

const threeDayHabit = {
  id: '42',
  name: 'Walk',
  completed: false,
  repeatDays: ['Mon', 'Wed', 'Fri'],
  reminderTime: '08:30 AM',
  reminderType: 'call' as const,
};

describe('reminder scheduling', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    notifeeMock.getTriggerNotificationIds.mockResolvedValue([]);
    notifeeMock.getTriggerNotifications.mockResolvedValue([]);
    notifeeMock.cancelTriggerNotification.mockResolvedValue();
    notifeeMock.cancelDisplayedNotification.mockResolvedValue();
    notifeeMock.createTriggerNotification.mockResolvedValue('');
    notifeeMock.createChannel.mockResolvedValue('');
  });

  it('creates one weekly trigger for every selected repeat day', async () => {
    const mondayAfterReminder = new Date(2026, 7, 17, 9, 0, 0);

    await scheduleHabitReminder(threeDayHabit, 'user-7', mondayAfterReminder);

    const created = notifeeMock.createTriggerNotification.mock.calls.map(
      ([notification, trigger]) => ({ notification, trigger }),
    );

    expect(created.map(({ notification }) => notification.id)).toEqual([
      NOTIFICATION_IDS.habit('42'),
      NOTIFICATION_IDS.habitWeekday('42', 'WED'),
      NOTIFICATION_IDS.habitWeekday('42', 'FRI'),
    ]);
    expect(
      created.map(({ notification }) => notification.data?.userId),
    ).toEqual(['user-7', 'user-7', 'user-7']);
    expect(
      created.map(({ trigger }) =>
        'repeatFrequency' in trigger ? trigger.repeatFrequency : undefined,
      ),
    ).toEqual([
      RepeatFrequency.WEEKLY,
      RepeatFrequency.WEEKLY,
      RepeatFrequency.WEEKLY,
    ]);

    const fireDates = created.map(
      ({ trigger }) => new Date('timestamp' in trigger ? trigger.timestamp : 0),
    );
    expect(fireDates.map(date => date.getDay())).toEqual([1, 3, 5]);
    expect(fireDates.map(date => [date.getHours(), date.getMinutes()])).toEqual(
      [
        [8, 30],
        [8, 30],
        [8, 30],
      ],
    );
    expect(fireDates[0].getDate()).toBe(24);
  });

  it('cancels only displayed habit notifications when a call is answered', async () => {
    await cancelDisplayedHabitNotifications('42');

    const displayedIds = notifeeMock.cancelDisplayedNotification.mock.calls.map(
      ([id]) => id,
    );
    expect(displayedIds).toContain(NOTIFICATION_IDS.habit('42'));
    expect(displayedIds).toContain(NOTIFICATION_IDS.habitWeekday('42', 'WED'));
    expect(displayedIds).toContain(NOTIFICATION_IDS.habitReschedule('42'));
    expect(notifeeMock.cancelTriggerNotification).not.toHaveBeenCalled();
  });

  it('dismisses a meal call without cancelling its daily trigger', async () => {
    await cancelDisplayedMealNotifications();

    expect(notifeeMock.cancelDisplayedNotification).toHaveBeenCalledWith(
      NOTIFICATION_IDS.mealDaily,
    );
    expect(notifeeMock.cancelDisplayedNotification).toHaveBeenCalledWith(
      NOTIFICATION_IDS.mealReschedule,
    );
    expect(notifeeMock.cancelTriggerNotification).not.toHaveBeenCalled();
  });

  it('reconciliation is idempotent and leaves the same pending set', async () => {
    const pending = new Map<
      string,
      Parameters<typeof notifee.createTriggerNotification>
    >();
    getAllHabits.mockResolvedValue([threeDayHabit]);
    notifeeMock.getTriggerNotifications.mockImplementation(async () =>
      [...pending.values()].map(([notification, trigger]) => ({
        notification,
        trigger,
      })),
    );
    notifeeMock.cancelTriggerNotification.mockImplementation(async id => {
      pending.delete(id);
    });
    notifeeMock.createTriggerNotification.mockImplementation(
      async (notification, trigger) => {
        if (notification.id) {
          pending.set(notification.id, [notification, trigger]);
        }
        return notification.id ?? '';
      },
    );

    await reconcileReminders('user-7');
    const firstPendingSet = [...pending.keys()].sort();
    await reconcileReminders('user-7');

    expect([...pending.keys()].sort()).toEqual(firstPendingSet);
    expect(firstPendingSet).toEqual(
      [
        NOTIFICATION_IDS.habit('42'),
        NOTIFICATION_IDS.habitWeekday('42', 'FRI'),
        NOTIFICATION_IDS.habitWeekday('42', 'WED'),
      ].sort(),
    );
  });

  it('drops one-off reminders owned by another or legacy user', async () => {
    getAllHabits.mockResolvedValue([]);
    notifeeMock.getTriggerNotifications.mockResolvedValue([
      {
        notification: {
          id: NOTIFICATION_IDS.mealReschedule,
          data: { userId: 'user-8' },
        },
        trigger: {
          type: TriggerType.TIMESTAMP,
          timestamp: Date.now() + 60_000,
        },
      },
      {
        notification: {
          id: NOTIFICATION_IDS.habitReschedule('42'),
          data: { userId: 'user-7' },
        },
        trigger: {
          type: TriggerType.TIMESTAMP,
          timestamp: Date.now() + 60_000,
        },
      },
    ]);

    await reconcileReminders('user-7');

    expect(notifeeMock.cancelTriggerNotification).toHaveBeenCalledWith(
      NOTIFICATION_IDS.mealReschedule,
    );
    expect(notifeeMock.cancelTriggerNotification).not.toHaveBeenCalledWith(
      NOTIFICATION_IDS.habitReschedule('42'),
    );
  });

  it('keeps the meal schedule value compatible and stores ownership separately', async () => {
    const reminder = { hour: 20, minute: 15, enabled: true };
    await saveSchedule(reminder, 'user-7');

    expect(await AsyncStorage.getItem(MEAL_SCHEDULE_STORAGE_KEY)).toBe(
      JSON.stringify(reminder),
    );
    expect(await AsyncStorage.getItem(MEAL_SCHEDULE_OWNER_STORAGE_KEY)).toBe(
      'user-7',
    );
    await expect(loadSchedule('user-7')).resolves.toEqual(reminder);
    await expect(loadSchedule('user-8')).resolves.toEqual({
      hour: 20,
      minute: 0,
      enabled: false,
    });
  });
});
