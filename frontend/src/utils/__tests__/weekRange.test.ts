import { getCurrentSundayToSaturdayRange } from '../weekRange';
import { parseLocalDateString } from '../date';

describe('getCurrentSundayToSaturdayRange', () => {
  it('spans Sunday→Saturday and reports days elapsed', () => {
    const now = new Date(2026, 5, 10, 15, 0); // arbitrary mid-week afternoon
    const r = getCurrentSundayToSaturdayRange(now);

    const start = parseLocalDateString(r.startDate);
    const end = parseLocalDateString(r.endDate);

    expect(start.getDay()).toBe(0); // Sunday
    expect(end.getDay()).toBe(6); // Saturday
    expect((end.getTime() - start.getTime()) / 86_400_000).toBe(6);
    expect(r.daysElapsed).toBe(now.getDay() + 1);
  });

  it('on a Sunday, daysElapsed is 1 and start is that day', () => {
    // Find a Sunday near the date above.
    const base = new Date(2026, 5, 10);
    const sunday = new Date(base);
    sunday.setDate(base.getDate() - base.getDay());
    const r = getCurrentSundayToSaturdayRange(sunday);
    expect(r.daysElapsed).toBe(1);
    expect(parseLocalDateString(r.startDate).getTime()).toBe(
      new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate()).getTime(),
    );
  });
});
