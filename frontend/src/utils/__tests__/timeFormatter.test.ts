import {
  formatTime12h,
  formatIsoTime12h,
  formatEpochTime12h,
  formatReminderTime,
  formatClockTime,
  formatClockTimeFromParts,
} from '../timeFormatter';

describe('formatTime12h (non-padded hour)', () => {
  it('formats afternoon times as PM with a non-padded hour', () => {
    expect(formatTime12h(new Date(2026, 5, 14, 21, 5))).toBe('9:05 PM');
  });
  it('formats morning single-digit hours without padding', () => {
    expect(formatTime12h(new Date(2026, 5, 14, 9, 30))).toBe('9:30 AM');
  });
  it('maps midnight and noon to 12', () => {
    expect(formatTime12h(new Date(2026, 5, 14, 0, 0))).toBe('12:00 AM');
    expect(formatTime12h(new Date(2026, 5, 14, 12, 0))).toBe('12:00 PM');
  });
});

describe('formatIsoTime12h', () => {
  it('parses an ISO string', () => {
    const iso = new Date(2026, 5, 14, 14, 7).toISOString();
    expect(formatIsoTime12h(iso)).toBe('2:07 PM');
  });
  it('returns empty string for an unparseable value', () => {
    expect(formatIsoTime12h('not-a-date')).toBe('');
  });
});

describe('formatEpochTime12h', () => {
  it('formats from an epoch timestamp', () => {
    const ts = new Date(2026, 5, 14, 8, 5).getTime();
    expect(formatEpochTime12h(ts)).toBe('8:05 AM');
  });
});

describe('formatReminderTime (zero-padded hour, persisted to backend)', () => {
  it('zero-pads the 12h hour', () => {
    expect(formatReminderTime(new Date(2026, 5, 14, 21, 5))).toBe('09:05 PM');
    expect(formatReminderTime(new Date(2026, 5, 14, 9, 5))).toBe('09:05 AM');
  });
  it('keeps double-digit hours intact', () => {
    expect(formatReminderTime(new Date(2026, 5, 14, 23, 45))).toBe('11:45 PM');
  });
});

describe('locale formatters', () => {
  it('formatClockTime returns a clock-shaped string', () => {
    expect(formatClockTime(new Date(2026, 5, 14, 9, 5))).toMatch(/\d{1,2}:\d{2}/);
  });
  it('formatClockTimeFromParts matches formatClockTime for the same time', () => {
    const fromParts = formatClockTimeFromParts(9, 5);
    const d = new Date();
    d.setHours(9, 5);
    expect(fromParts).toBe(formatClockTime(d));
  });
});
