import { parseClockTime, formatClock24Key, canonicalSlotKey } from '../clockTime';

describe('parseClockTime', () => {
  it('parses 12-hour times', () => {
    expect(parseClockTime('8:30 AM')).toEqual({ hour: 8, minute: 30 });
    expect(parseClockTime('08:30 AM')).toEqual({ hour: 8, minute: 30 });
    expect(parseClockTime('12:00 AM')).toEqual({ hour: 0, minute: 0 });
    expect(parseClockTime('12:00 PM')).toEqual({ hour: 12, minute: 0 });
    expect(parseClockTime('1:05 pm')).toEqual({ hour: 13, minute: 5 });
    expect(parseClockTime('11:59 PM')).toEqual({ hour: 23, minute: 59 });
  });

  it('parses 24-hour times', () => {
    expect(parseClockTime('20:00')).toEqual({ hour: 20, minute: 0 });
    expect(parseClockTime('00:00')).toEqual({ hour: 0, minute: 0 });
    expect(parseClockTime('23:59')).toEqual({ hour: 23, minute: 59 });
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseClockTime('  8:30 AM  ')).toEqual({ hour: 8, minute: 30 });
  });

  it('returns null instead of defaulting to 08:00 on bad input', () => {
    // This is the P0 #7 fix: never silently schedule a wrong-time call.
    expect(parseClockTime('')).toBeNull();
    expect(parseClockTime('not a time')).toBeNull();
    expect(parseClockTime('25:00')).toBeNull();
    expect(parseClockTime('8:60 AM')).toBeNull();
    expect(parseClockTime('13:00 PM')).toBeNull();
    expect(parseClockTime('8 AM')).toBeNull();
    expect(parseClockTime(null)).toBeNull();
    expect(parseClockTime(undefined)).toBeNull();
  });
});

describe('canonical slot key', () => {
  it('formats a 24h key', () => {
    expect(formatClock24Key({ hour: 8, minute: 30 })).toBe('08:30');
    expect(formatClock24Key({ hour: 20, minute: 0 })).toBe('20:00');
  });

  it('collapses equivalent strings to one canonical key', () => {
    const a = canonicalSlotKey('8:30 AM');
    const b = canonicalSlotKey(' 08:30 AM ');
    const c = canonicalSlotKey('08:30');
    expect(a).toBe('08:30');
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it('returns null for unparseable times', () => {
    expect(canonicalSlotKey('whenever')).toBeNull();
  });
});
