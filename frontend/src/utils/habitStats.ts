import { Habit } from '../types/types';

export interface HabitStats {
  completedCount: number;
  totalCount: number;
  /** 0–100, clamped. */
  progressPercent: number;
}

/** Pure derivation of today's habit progress. */
export function calculateHabitStats(habits: Habit[]): HabitStats {
  const totalCount = habits.length;
  const completedCount = habits.filter(h => h.completed).length;
  const progressPercent =
    totalCount > 0 ? Math.min(100, (completedCount / totalCount) * 100) : 0;
  return { completedCount, totalCount, progressPercent };
}
