import { Meals } from '../types/types';
import { CANONICAL_MEAL_ORDER } from './meals';

export interface MealSlot {
  key: string;
  label: string;
}

/** The user-facing meal slots, in display order. */
export const MEAL_SLOTS: MealSlot[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'snack', label: 'Snack' },
  { key: 'dinner', label: 'Dinner' },
];

export interface MealSlotStatus extends MealSlot {
  logged: boolean;
  count: number;
}

/** Per-slot logged/count status derived from a normalized meals map. */
export function buildMealSlotStatus(meals: Meals): MealSlotStatus[] {
  return CANONICAL_MEAL_ORDER.map(key => {
    const slot = MEAL_SLOTS.find(s => s.key === key)!;
    const entries = meals[key] || [];
    return { ...slot, logged: entries.length > 0, count: entries.length };
  });
}
