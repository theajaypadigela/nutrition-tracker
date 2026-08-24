import { computeDesiredTriggers } from '../scheduler';
import { zonedWallTimeToEpoch } from '../time';
import { Habit } from '@/types/types';

const TZ = 'America/New_York';

// 2026-06-13 is a Saturday.
const NOW = zonedWallTimeToEpoch(
  { year: 2026, month: 6, day: 13, hour: 12, minute: 0 },
  TZ,
);

function habit(over: Partial<Habit>): Habit {
  return {
    id: 'h1',
    name: 'Drink water',
    completed: false,
    repeatDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    reminderTime: '08:00 AM',
    reminderType: 'call',
    ...over,
  };
}

const NO_MEAL = { hour: 20, minute: 0, enabled: false };

describe('computeDesiredTriggers — meal', () => {
  it('arms one daily meal trigger when enabled', () => {
    const plan = computeDesiredTriggers({
      meal: { hour: 20, minute: 0, enabled: true },
      habits: [],
      reschedules: [],
      nowEpoch: NOW,
      timeZone: TZ,
    });
    expect(plan.desired.map(d => d.id)).toEqual(['meal-alarm-daily']);
    expect(plan.specs.get('meal-alarm-daily')?.repeat).toBe('daily');
    expect(plan.specs.get('meal-alarm-daily')?.isCall).toBe(true);
  });

  it('arms nothing for meal when disabled', () => {
    const plan = computeDesiredTriggers({
      meal: NO_MEAL,
      habits: [],
      reschedules: [],
      nowEpoch: NOW,
      timeZone: TZ,
    });
    expect(plan.desired).toHaveLength(0);
  });
});

describe('computeDesiredTriggers — habit recurrence', () => {
  it('collapses an all-7-days call habit into a single daily trigger', () => {
    const plan = computeDesiredTriggers({
      meal: NO_MEAL,
      habits: [habit({ reminderType: 'call', reminderTime: '08:00 AM' })],
      reschedules: [],
      nowEpoch: NOW,
      timeZone: TZ,
    });
    expect(plan.desired.map(d => d.id)).toEqual(['habit-call-08:00']);
    expect(plan.specs.get('habit-call-08:00')?.repeat).toBe('daily');
  });

  it('arms one weekly trigger per selected weekday for a partial-week habit', () => {
    const plan = computeDesiredTriggers({
      meal: NO_MEAL,
      habits: [
        habit({ repeatDays: ['Mon', 'Wed', 'Fri'], reminderTime: '09:00 AM' }),
      ],
      reschedules: [],
      nowEpoch: NOW,
      timeZone: TZ,
    });
    expect(plan.desired.map(d => d.id).sort()).toEqual([
      'habit-call-09:00-Fri',
      'habit-call-09:00-Mon',
      'habit-call-09:00-Wed',
    ]);
    expect(plan.specs.get('habit-call-09:00-Mon')?.repeat).toBe('weekly');
  });

  it('consolidates multiple call habits at one slot, unioning their weekdays', () => {
    const plan = computeDesiredTriggers({
      meal: NO_MEAL,
      habits: [
        habit({ id: 'a', repeatDays: ['Mon'], reminderTime: '8:00 AM' }),
        habit({ id: 'b', repeatDays: ['Tue'], reminderTime: '08:00 AM' }),
      ],
      reschedules: [],
      nowEpoch: NOW,
      timeZone: TZ,
    });
    // Same canonical slot 08:00; two distinct weekdays => two weekly triggers, one slot.
    expect(plan.desired.map(d => d.id).sort()).toEqual([
      'habit-call-08:00-Mon',
      'habit-call-08:00-Tue',
    ]);
  });

  it('keeps push habits per-habit', () => {
    const plan = computeDesiredTriggers({
      meal: NO_MEAL,
      habits: [
        habit({ id: 'p1', reminderType: 'notification', reminderTime: '07:30 AM' }),
      ],
      reschedules: [],
      nowEpoch: NOW,
      timeZone: TZ,
    });
    expect(plan.desired.map(d => d.id)).toEqual(['habit-push-p1']);
    expect(plan.specs.get('habit-push-p1')?.isCall).toBe(false);
  });

  it('suppresses recurring habit calls but keeps local call-me-back reschedules', () => {
    const plan = computeDesiredTriggers({
      meal: { hour: 20, minute: 0, enabled: true },
      habits: [
        habit({ id: 'call', reminderType: 'call' }),
        habit({ id: 'push', reminderType: 'notification' }),
      ],
      reschedules: [
        { id: 'habit-reschedule-call-08:00', kind: 'habit-call', fireAt: NOW + 1_000 },
        { id: 'meal-reschedule-once', kind: 'meal-call', fireAt: NOW + 2_000 },
      ],
      nowEpoch: NOW,
      timeZone: TZ,
      suppressHabitCalls: true,
    });

    expect(plan.desired.map(item => item.id).sort()).toEqual([
      'habit-push-push',
      'habit-reschedule-call-08:00',
      'meal-alarm-daily',
      'meal-reschedule-once',
    ]);
  });

  it('records an unparseable reminderTime instead of scheduling an 8am default', () => {
    const plan = computeDesiredTriggers({
      meal: NO_MEAL,
      habits: [habit({ id: 'bad', reminderTime: 'whenever' })],
      reschedules: [],
      nowEpoch: NOW,
      timeZone: TZ,
    });
    expect(plan.desired).toHaveLength(0);
    expect(plan.unparseableHabits).toEqual([
      { habitId: 'bad', habitName: 'Drink water', reminderTime: 'whenever' },
    ]);
  });
});

describe('computeDesiredTriggers — reschedules', () => {
  it('arms future reschedules and skips past ones', () => {
    const plan = computeDesiredTriggers({
      meal: NO_MEAL,
      habits: [],
      reschedules: [
        { id: 'meal-reschedule-once', kind: 'meal-call', fireAt: NOW + 600_000 },
        { id: 'stale', kind: 'meal-call', fireAt: NOW - 600_000 },
      ],
      nowEpoch: NOW,
      timeZone: TZ,
    });
    expect(plan.desired.map(d => d.id)).toEqual(['meal-reschedule-once']);
    expect(plan.specs.get('meal-reschedule-once')?.repeat).toBe('none');
  });
});
