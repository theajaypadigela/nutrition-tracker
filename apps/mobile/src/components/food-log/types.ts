export interface FoodItem {
  id: string;
  name: string;
  quantity: string;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Meals {
  [key: string]: FoodItem[];
}

export type MealType = 'Breakfast' | 'Lunch' | 'Snacks' | 'Dinner';

export interface FoodErrors {
  foodName: string;
  quantity: string;
  servingSize: string;
}
