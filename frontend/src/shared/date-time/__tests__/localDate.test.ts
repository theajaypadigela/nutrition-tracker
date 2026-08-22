import {
  formatLocalDate,
  trailingLocalDateRange,
} from '../localDate';

describe('local calendar date helpers', () => {
  it('formats calendar fields without a UTC conversion', () => {
    expect(formatLocalDate(new Date(2026, 7, 9, 23, 59))).toBe('2026-08-09');
  });

  it('pads single-digit months and days', () => {
    expect(formatLocalDate(new Date(2026, 0, 2))).toBe('2026-01-02');
  });

  it('builds an inclusive trailing range across month boundaries', () => {
    expect(trailingLocalDateRange(7, new Date(2026, 2, 2, 12))).toEqual({
      startDate: '2026-02-24',
      endDate: '2026-03-02',
    });
  });

  it('rejects invalid inputs', () => {
    expect(() => formatLocalDate(new Date(Number.NaN))).toThrow(RangeError);
    expect(() => trailingLocalDateRange(0)).toThrow(RangeError);
  });
});
