import {
  DayKey,
  toggleDay,
  toggleAllDays,
  toggleWeekdays,
  toggleWeekends,
  isAllDays,
  isWeekdaysOnly,
  isWeekendsOnly,
  getRepeatSummary,
  WEEKDAYS,
  WEEKENDS,
  ALL_DAYS,
} from '../daySelection';

describe('toggleDay', () => {
  it('adds an absent day and removes a present one', () => {
    expect(toggleDay([], 'Mon')).toEqual(['Mon']);
    expect(toggleDay(['Mon', 'Tue'], 'Mon')).toEqual(['Tue']);
  });
});

describe('quick-pick toggles', () => {
  it('toggleAllDays selects all, or clears when already all', () => {
    expect(toggleAllDays([])).toEqual(ALL_DAYS);
    expect(toggleAllDays([...ALL_DAYS])).toEqual([]);
  });
  it('toggleWeekdays selects weekdays, or clears when already weekdays-only', () => {
    expect(toggleWeekdays([])).toEqual(WEEKDAYS);
    expect(toggleWeekdays([...WEEKDAYS])).toEqual([]);
  });
  it('toggleWeekends selects weekends, or clears when already weekends-only', () => {
    expect(toggleWeekends([])).toEqual(WEEKENDS);
    expect(toggleWeekends([...WEEKENDS])).toEqual([]);
  });
});

describe('predicates', () => {
  it('isAllDays only when 7 selected', () => {
    expect(isAllDays([...ALL_DAYS])).toBe(true);
    expect(isAllDays([...WEEKDAYS])).toBe(false);
  });
  it('isWeekdaysOnly requires all weekdays and no weekend days', () => {
    expect(isWeekdaysOnly([...WEEKDAYS])).toBe(true);
    expect(isWeekdaysOnly(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as DayKey[])).toBe(
      false,
    );
    expect(isWeekdaysOnly(['Mon'] as DayKey[])).toBe(false);
  });
  it('isWeekendsOnly requires both weekend days and no weekdays', () => {
    expect(isWeekendsOnly([...WEEKENDS])).toBe(true);
    expect(isWeekendsOnly(['Sat'] as DayKey[])).toBe(false);
    expect(isWeekendsOnly(['Sat', 'Sun', 'Mon'] as DayKey[])).toBe(false);
  });
});

describe('getRepeatSummary', () => {
  it('summarizes the common cases', () => {
    expect(getRepeatSummary([])).toBe('No days selected');
    expect(getRepeatSummary([...ALL_DAYS])).toBe('Every day');
    expect(getRepeatSummary([...WEEKDAYS])).toBe('Weekdays');
    expect(getRepeatSummary([...WEEKENDS])).toBe('Weekends');
    expect(getRepeatSummary(['Mon', 'Wed'] as DayKey[])).toBe('Mon, Wed');
  });
});
