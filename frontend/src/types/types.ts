// User & Auth
export interface User {
  id: string;
  name: string;
  email: string;
  age?: string;
  gender?: string;
}

// Navigation

export type TabName = 'Home' | 'Habits' | 'Food' | 'Reports' | 'Profile';

// Habits

export type ReminderType = 'notification' | 'call';

export interface Habit {
  id: string;
  name: string;
  completed: boolean;
  repeatDays: string[];
  reminderTime: string;
  reminderType: ReminderType;
  status?: string; // PENDING, COMPLETED, MISSED, RESCHEDULED
  completedAt?: string | null;
  rescheduledTime?: string | null;
}

export interface HabitVoiceResult {
  habit_name: string;
  habit_status: 'completed' | 'not_completed' | 'rescheduled';
  reschedule_minutes?: number | null;
  completed_at?: string | null;
}

export interface HabitVoiceInterpretationResponse {
  habitStatus: 'completed' | 'not_completed' | 'rescheduled';
  rescheduleMinutes?: number | null;
  rationale?: string;
}

export interface MealVoiceInterpretationResponse {
  shouldLogMeals: boolean;
  rescheduleMinutes?: number | null;
  rationale?: string;
}

// Food Logging

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

// Backend FoodEntry structure (matches API response)
export interface FoodEntry {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  mealType: string;
  createdAt: string | null;
  updatedAt: string | null;
}

// Meal group from backend
export interface MealGroup {
  mealType: string;
  entries: FoodEntry[];
}

// Complete food log response from backend
export interface FoodLogResponse {
  foodLogId: string;
  date: string;
  meals: MealGroup[];
}

// Legacy FoodItem (for UI components)
export interface FoodItem {
  id: string;
  name: string;
  quantity: string;
  servingSize: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
}

export interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

export interface Meals {
  [key: string]: FoodItem[];
}

export interface MealsResponse {
  meals: Meals;
  totals: NutritionTotals;
}

export interface DailyNutritionSummary {
  date: string;
  totals: NutritionTotals;
}

export interface WeeklyNutritionReport {
  avgDailyCalories: number;
  weeklyTotals: NutritionTotals;
  weeklyAverage: NutritionTotals;
  dailySummaries: DailyNutritionSummary[];
}

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export interface FoodErrors {
  foodName: string;
  quantity: string;
  servingSize: string;
}

// Daily Nutrition Aggregates

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

// Nutrient Tracking Configuration

export type TrackingFrequency = 'daily' | 'weekly' | 'optional';

export type NutrientCategory =
  | 'macro'
  | 'micro'
  | 'vitamin'
  | 'mineral'
  | 'custom';

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

// Dashboard
export interface DashboardResponse {
  date: string;
  foodSummary: MealsResponse;
  habits: Habit[];
}
