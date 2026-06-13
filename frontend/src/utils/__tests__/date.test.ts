import {
  addDaysToLocalDate,
  formatLocalDate,
  getTodayLocalDate,
  isSameLocalCalendarDay,
  parseLocalDateString,
} from '../date';

describe('formatLocalDate', () => {
  it('formats as YYYY-MM-DD with zero padding', () => {
    expect(formatLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(formatLocalDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('getTodayLocalDate', () => {
  it('matches formatLocalDate of the current date', () => {
    expect(getTodayLocalDate()).toBe(formatLocalDate(new Date()));
  });
});

describe('addDaysToLocalDate', () => {
  it('adds days and crosses month boundaries', () => {
    expect(formatLocalDate(addDaysToLocalDate(new Date(2026, 0, 30), 3))).toBe(
      '2026-02-02',
    );
  });

  it('subtracts with negative input', () => {
    expect(formatLocalDate(addDaysToLocalDate(new Date(2026, 0, 1), -1))).toBe(
      '2025-12-31',
    );
  });

  it('does not mutate the input date', () => {
    const original = new Date(2026, 0, 1);
    addDaysToLocalDate(original, 10);
    expect(formatLocalDate(original)).toBe('2026-01-01');
  });
});

describe('parseLocalDateString', () => {
  it('parses a valid YYYY-MM-DD into a local-midnight date', () => {
    const d = parseLocalDateString('2026-06-14');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(14);
  });

  it('round-trips with formatLocalDate', () => {
    expect(formatLocalDate(parseLocalDateString('2026-03-09'))).toBe(
      '2026-03-09',
    );
  });
});

describe('isSameLocalCalendarDay', () => {
  it('ignores time-of-day', () => {
    expect(
      isSameLocalCalendarDay(
        new Date(2026, 5, 14, 1, 0, 0),
        new Date(2026, 5, 14, 23, 59, 59),
      ),
    ).toBe(true);
  });

  it('distinguishes different days', () => {
    expect(
      isSameLocalCalendarDay(new Date(2026, 5, 14), new Date(2026, 5, 15)),
    ).toBe(false);
  });
});
