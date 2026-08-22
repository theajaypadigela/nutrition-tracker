import {
  NOTIFICATION_ACTION_IDS,
  NOTIFICATION_CHANNEL_IDS,
  NOTIFICATION_IDS,
  notificationBelongsToUser,
  parseCallNotificationPayload,
  resolveNotificationNavigation,
} from '../contracts';

describe('notification contracts', () => {
  it('keeps persistent identifiers stable', () => {
    expect(NOTIFICATION_CHANNEL_IDS).toEqual({
      mealCall: 'meal-call-v2',
      habitCall: 'habit-call-v1',
      habitPush: 'habit-push-v1',
    });
    expect(NOTIFICATION_ACTION_IDS).toEqual({
      default: 'default',
      accept: 'accept',
      decline: 'decline',
    });
    expect(NOTIFICATION_IDS.habit('42')).toBe('habit-42');
    expect(NOTIFICATION_IDS.habitWeekday('42', 'WED')).toBe('habit-42-wed');
    expect(NOTIFICATION_IDS.habitReschedule('42')).toBe('habit-reschedule-42');
  });

  it('maps an accepted meal call to the voice screen', () => {
    const payload = parseCallNotificationPayload({
      screen: 'IncomingMealCall',
      userId: '7',
      mealSlotId: 'rescheduled',
      delayMinutes: '15',
    });

    expect(payload).not.toBeNull();
    expect(resolveNotificationNavigation(payload!, 'accept')).toEqual({
      screen: 'VoiceMealLog',
      params: { mealSlotId: 'rescheduled', autoStart: true },
    });
  });

  it('maps an opened habit call to the incoming-call screen', () => {
    const payload = parseCallNotificationPayload({
      screen: 'IncomingHabitCall',
      userId: '7',
      habitId: '9',
      habitName: 'Walk',
      habitTime: '08:30 AM',
    });

    expect(payload).not.toBeNull();
    expect(resolveNotificationNavigation(payload!, 'open')).toEqual({
      screen: 'IncomingHabitCall',
      params: {
        habitId: '9',
        habitName: 'Walk',
        habitTime: '08:30 AM',
        autoAccept: false,
      },
    });
  });

  it('accepts notification payloads only for the authenticated owner', () => {
    const payload = parseCallNotificationPayload({
      screen: 'IncomingMealCall',
      mealSlotId: 'daily',
      userId: '7',
    });

    expect(payload).not.toBeNull();
    expect(notificationBelongsToUser(payload!, '7')).toBe(true);
    expect(notificationBelongsToUser(payload!, '8')).toBe(false);
    expect(notificationBelongsToUser(payload!, null)).toBe(false);
  });

  it('rejects malformed or unrelated payloads', () => {
    expect(
      parseCallNotificationPayload({
        screen: 'IncomingHabitCall',
        habitId: '9',
      }),
    ).toBeNull();
    expect(parseCallNotificationPayload({ screen: 'Habits' })).toBeNull();
    expect(
      parseCallNotificationPayload({
        screen: 'IncomingMealCall',
        mealSlotId: 'daily',
      }),
    ).toBeNull();
  });
});
