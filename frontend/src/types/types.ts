// ============================================================
// User & Auth
// ============================================================

export interface User {
  id: string;
  name: string;
  email: string;
  age?: string;
  gender?: string;
}

// ============================================================
// Navigation
// ============================================================

export type TabName = 'Home' | 'Habits' | 'Food' | 'Reports' | 'Profile';

// ============================================================
// Habits
// ============================================================

export interface Habit {
  id: string;
  name: string;
  completed: boolean;
  time?: string;
  repeatedDays?: string;
}

// ============================================================
// Food Logging
// ============================================================

/** Simplified food entry used in dashboard / calendar day summaries */
export interface FoodLog {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Detailed food item used in the food-log feature (meals, editing, etc.) */
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

// ============================================================
// Daily Nutrition Aggregates
// ============================================================

export interface DailyNutritionTotals {
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
}

export interface DailyNutritionGoals {
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
}

// ============================================================
// Nutrient Tracking Configuration
// ============================================================

export type TrackingFrequency = 'daily' | 'weekly' | 'optional';

export type NutrientCategory = 'macro' | 'micro' | 'vitamin' | 'mineral' | 'custom';

export interface NutrientDefinition {
  id: string;
  name: string;
  unit: string;
  min?: number;
  max?: number;
  target?: number;
  trackingFrequency: TrackingFrequency;
  category: NutrientCategory;
  isRequired: boolean;
}

