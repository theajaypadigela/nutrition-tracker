import {
  ScheduleIntent,
  dailyRecurrence,
  weeklyRecurrence,
  nextOccurrence,
  nextOccurrences,
} from '../scheduleIntent';
import { epochToZonedParts, zonedWallTimeToEpoch } from '../time';

const TZ = 'America/New_York';

function at(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  return zonedWallTimeToEpoch({ year, month, day, hour, minute }, TZ);
}

describe('nextOccurrence — daily', () => {
  const intent: ScheduleIntent = {
    time: { hour: 20, minute: 0 },
    recurrence: dailyRecurrence(),
  };

  it('returns today when the time is still ahead', () => {
    const from = at(2026, 6, 13, 19, 0); // 7pm, before 8pm
    const next = nextOccurrence(intent, from, TZ)!;
    const p = epochToZonedParts(next, TZ);
    expect(p.day).toBe(13);
    expect(p.hour).toBe(20);
    expect(p.minute).toBe(0);
  });

  it('rolls to tomorrow when the time has passed', () => {
    const from = at(2026, 6, 13, 21, 0); // 9pm, after 8pm
    const next = nextOccurrence(intent, from, TZ)!;
    const p = epochToZonedParts(next, TZ);
    expect(p.day).toBe(14);
    expect(p.hour).toBe(20);
  });

  it('saving exactly at the reminder minute schedules the next day, not an immediate re-ring', () => {
    const from = at(2026, 6, 13, 20, 0); // exactly 8:00pm
    const next = nextOccurrence(intent, from, TZ)!;
    const p = epochToZonedParts(next, TZ);
    // fromEpoch is the top of 20:00; strictly-future rule -> tomorrow.
    expect(p.day).toBe(14);
    expect(p.hour).toBe(20);
  });

  it('a save one second before the minute still fires today', () => {
    const from = at(2026, 6, 13, 20, 0) - 1000;
    const next = nextOccurrence(intent, from, TZ)!;
    const p = epochToZonedParts(next, TZ);
    expect(p.day).toBe(13);
    expect(p.hour).toBe(20);
  });
});

describe('nextOccurrence — near midnight (off-by-one-day)', () => {
  const intent: ScheduleIntent = {
    time: { hour: 0, minute: 5 },
    recurrence: dailyRecurrence(),
  };

  it('00:05 saved at 23:59 fires in 6 minutes, same calendar advance', () => {
    const from = at(2026, 6, 13, 23, 59);
    const next = nextOccurrence(intent, from, TZ)!;
    const p = epochToZonedParts(next, TZ);
    expect(p.day).toBe(14);
    expect(p.hour).toBe(0);
    expect(p.minute).toBe(5);
  });
});

describe('nextOccurrence — weekly repeatDays filtering', () => {
  // Mon/Wed/Fri. 2026-06-13 is a Saturday.
  const intent: ScheduleIntent = {
    time: { hour: 9, minute: 0 },
    recurrence: weeklyRecurrence(['Mon', 'Wed', 'Fri']),
  };

  it('skips non-selected days to the next selected weekday', () => {
    const fromSat = at(2026, 6, 13, 12, 0); // Saturday noon
    const next = nextOccurrence(intent, fromSat, TZ)!;
    const p = epochToZonedParts(next, TZ);
    // Next Mon is 2026-06-15.
    expect(p.weekday).toBe(1); // Monday
    expect(p.day).toBe(15);
    expect(p.hour).toBe(9);
  });

  it('returns null when no days are selected', () => {
    const empty: ScheduleIntent = {
      time: { hour: 9, minute: 0 },
      recurrence: weeklyRecurrence([]),
    };
    expect(nextOccurrence(empty, at(2026, 6, 13, 12, 0), TZ)).toBeNull();
  });

  it('drops unrecognised day codes', () => {
    const r = weeklyRecurrence(['Mon', 'Funday' as any, 'Fri']);
    expect(r).toEqual({ kind: 'weekly', days: ['Mon', 'Fri'] });
  });
});

describe('nextOccurrences — rolling window', () => {
  it('produces N strictly-increasing daily fires', () => {
    const intent: ScheduleIntent = {
      time: { hour: 20, minute: 0 },
      recurrence: dailyRecurrence(),
    };
    const from = at(2026, 6, 13, 19, 0);
    const list = nextOccurrences(intent, from, 5, TZ);
    expect(list).toHaveLength(5);
    for (let i = 1; i < list.length; i++) {
      expect(list[i]).toBeGreaterThan(list[i - 1]);
    }
    // Consecutive daily fires are ~24h apart.
    expect(list[1] - list[0]).toBe(24 * 3600 * 1000);
  });

  it('weekly window lands only on selected weekdays', () => {
    const intent: ScheduleIntent = {
      time: { hour: 9, minute: 0 },
      recurrence: weeklyRecurrence(['Mon', 'Fri']),
    };
    const from = at(2026, 6, 13, 12, 0); // Saturday
    const list = nextOccurrences(intent, from, 4, TZ);
    const weekdays = list.map(e => epochToZonedParts(e, TZ).weekday);
    expect(weekdays.every(w => w === 1 || w === 5)).toBe(true);
  });
});

describe('nextOccurrence — leap day', () => {
  it('handles Feb 29 on a leap year without skipping', () => {
    // 2028 is a leap year; Feb 29 2028 is a Tuesday.
    const intent: ScheduleIntent = {
      time: { hour: 7, minute: 0 },
      recurrence: dailyRecurrence(),
    };
    const fromFeb28 = at(2028, 2, 28, 23, 0);
    const next = nextOccurrence(intent, fromFeb28, TZ)!;
    const p = epochToZonedParts(next, TZ);
    expect(p.month).toBe(2);
    expect(p.day).toBe(29);
  });
});

describe('nextOccurrence — DST daily continuity', () => {
  it('keeps firing at the wall-clock minute across spring-forward (no drift)', () => {
    const intent: ScheduleIntent = {
      time: { hour: 8, minute: 0 },
      recurrence: dailyRecurrence(),
    };
    // Day before the 2026-03-08 transition, after 8am.
    const from = at(2026, 3, 7, 9, 0);
    const next = nextOccurrence(intent, from, TZ)!;
    const p = epochToZonedParts(next, TZ);
    expect(p.day).toBe(8);
    expect(p.hour).toBe(8); // still 8am local, not 7 or 9 — wall-clock recompute corrects drift
    expect(p.minute).toBe(0);
  });
});
