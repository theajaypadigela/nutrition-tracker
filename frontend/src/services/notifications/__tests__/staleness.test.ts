import {
  classifyFire,
  isStale,
  DEFAULT_STALENESS_THRESHOLD_MS,
} from '../staleness';

describe('classifyFire', () => {
  const intended = Date.UTC(2026, 5, 13, 20, 0, 0);

  it('treats an on-time fire as fresh', () => {
    expect(classifyFire(intended, intended)).toBe('fresh');
  });

  it('treats a fire within threshold as fresh', () => {
    expect(classifyFire(intended, intended + DEFAULT_STALENESS_THRESHOLD_MS)).toBe(
      'fresh',
    );
  });

  it('treats a fire just past threshold as stale', () => {
    expect(
      classifyFire(intended, intended + DEFAULT_STALENESS_THRESHOLD_MS + 1),
    ).toBe('stale');
  });

  it('treats a future fire as fresh', () => {
    expect(classifyFire(intended, intended - 60_000)).toBe('fresh');
  });

  it('flags a reboot-replayed alarm hours late as stale (the 3am-call scenario)', () => {
    const sevenHoursLate = intended + 7 * 3600 * 1000;
    expect(isStale(intended, sevenHoursLate)).toBe(true);
  });

  it('respects a custom threshold', () => {
    expect(classifyFire(intended, intended + 2 * 60_000, 60_000)).toBe('stale');
    expect(classifyFire(intended, intended + 30_000, 60_000)).toBe('fresh');
  });
});
