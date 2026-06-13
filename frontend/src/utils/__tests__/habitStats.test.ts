import { calculateHabitStats } from '../habitStats';
import { Habit } from '../../types/types';

const habit = (over: Partial<Habit>): Habit => ({
  id: 'h',
  name: 'Habit',
  completed: false,
  repeatDays: [],
  reminderTime: '08:00 AM',
  reminderType: 'notification',
  ...over,
});

describe('calculateHabitStats', () => {
  it('returns zeros for an empty list (no divide-by-zero)', () => {
    expect(calculateHabitStats([])).toEqual({
      completedCount: 0,
      totalCount: 0,
      progressPercent: 0,
    });
  });

  it('counts completed habits and computes percent', () => {
    const stats = calculateHabitStats([
      habit({ id: '1', completed: true }),
      habit({ id: '2', completed: false }),
      habit({ id: '3', completed: true }),
      habit({ id: '4', completed: false }),
    ]);
    expect(stats.completedCount).toBe(2);
    expect(stats.totalCount).toBe(4);
    expect(stats.progressPercent).toBe(50);
  });

  it('clamps to 100', () => {
    const stats = calculateHabitStats([habit({ id: '1', completed: true })]);
    expect(stats.progressPercent).toBe(100);
  });
});
