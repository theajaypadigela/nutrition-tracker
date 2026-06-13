import { FoodItem } from '../types/types';

export interface FoodMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Sum the macros across a list of food items (missing values treated as 0). Raw sums; the
 *  caller rounds for display. */
export function calculateFoodMacros(foods: FoodItem[]): FoodMacros {
  return foods.reduce<FoodMacros>(
    (acc, f) => ({
      calories: acc.calories + (f.calories || 0),
      protein: acc.protein + (f.protein || 0),
      carbs: acc.carbs + (f.carbs || 0),
      fat: acc.fat + (f.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}
