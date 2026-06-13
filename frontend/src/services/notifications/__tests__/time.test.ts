import {
  epochToZonedParts,
  zonedWallTimeToEpoch,
  timeZoneOffsetMs,
  weekdayIndexToCode,
  normalizeWeekdayCode,
} from '../time';

describe('timeZoneOffsetMs', () => {
  it('reports a positive offset for zones ahead of UTC', () => {
    // 2026-06-01T00:00:00Z, India is UTC+5:30 year-round.
    const epoch = Date.UTC(2026, 5, 1, 0, 0, 0);
    expect(timeZoneOffsetMs(epoch, 'Asia/Kolkata')).toBe(5.5 * 3600 * 1000);
  });

  it('reflects DST for zones that observe it', () => {
    const winter = Date.UTC(2026, 0, 15, 12, 0, 0); // Jan -> EST (-5)
    const summer = Date.UTC(2026, 6, 15, 12, 0, 0); // Jul -> EDT (-4)
    expect(timeZoneOffsetMs(winter, 'America/New_York')).toBe(-5 * 3600 * 1000);
    expect(timeZoneOffsetMs(summer, 'America/New_York')).toBe(-4 * 3600 * 1000);
  });
});

describe('zonedWallTimeToEpoch round-trips', () => {
  it('round-trips an ordinary wall time', () => {
    const epoch = zonedWallTimeToEpoch(
      { year: 2026, month: 6, day: 13, hour: 20, minute: 0 },
      'America/New_York',
    );
    const parts = epochToZonedParts(epoch, 'America/New_York');
    expect(parts.hour).toBe(20);
    expect(parts.minute).toBe(0);
    expect(parts.day).toBe(13);
  });

  it('round-trips in a half-hour-offset zone', () => {
    const epoch = zonedWallTimeToEpoch(
      { year: 2026, month: 6, day: 13, hour: 8, minute: 30 },
      'Asia/Kolkata',
    );
    const parts = epochToZonedParts(epoch, 'Asia/Kolkata');
    expect(parts.hour).toBe(8);
    expect(parts.minute).toBe(30);
  });
});

describe('DST spring-forward (gap)', () => {
  // 2026-03-08: America/New_York jumps 02:00 EST -> 03:00 EDT, so 02:30 doesn't exist.
  it('rolls a non-existent wall time forward across the gap', () => {
    const epoch = zonedWallTimeToEpoch(
      { year: 2026, month: 3, day: 8, hour: 2, minute: 30 },
      'America/New_York',
    );
    const parts = epochToZonedParts(epoch, 'America/New_York');
    // Resolves to the post-gap instant (03:30 EDT), never 01:30.
    expect(parts.hour).toBe(3);
    expect(parts.minute).toBe(30);
  });
});

describe('DST fall-back (overlap)', () => {
  // 2026-11-01: clocks fall back 02:00 EDT -> 01:00 EST, so 01:30 occurs twice.
  it('picks the first (pre-transition) occurrence', () => {
    const epoch = zonedWallTimeToEpoch(
      { year: 2026, month: 11, day: 1, hour: 1, minute: 30 },
      'America/New_York',
    );
    // First 01:30 is still EDT (UTC-4) => 05:30Z; the second would be 06:30Z (EST).
    expect(epoch).toBe(Date.UTC(2026, 10, 1, 5, 30, 0));
  });
});

describe('weekday helpers', () => {
  it('maps JS weekday index to backend code', () => {
    expect(weekdayIndexToCode(0)).toBe('Sun');
    expect(weekdayIndexToCode(1)).toBe('Mon');
    expect(weekdayIndexToCode(6)).toBe('Sat');
  });

  it('normalizes case/whitespace and rejects junk', () => {
    expect(normalizeWeekdayCode(' mon ')).toBe('Mon');
    expect(normalizeWeekdayCode('TUE')).toBe('Tue');
    expect(normalizeWeekdayCode('Funday')).toBeNull();
  });
});
