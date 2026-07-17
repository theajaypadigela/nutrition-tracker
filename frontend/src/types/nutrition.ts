import { ReactNode } from 'react';

/**
 * Shared nutrition domain types. Previously these lived under
 * src/components/nutrition-report (types.ts + weekly-summary/tokens.ts), which made
 * the data hooks depend upward on component code; they now live with the other
 * domain types so both hooks and components import downward.
 */

// ============================================================
// Simple current/goal pair — used by macro & micro summary cards
// ============================================================

export interface NutrientData {
  current: number;
  goal: number;
  weeklyGoal?: number;
}

// ============================================================
// Macro / Micro display models
// ============================================================

export interface MacroNutrient {
  label: string;
  current: number;
  goal: number;
  weeklyGoal?: number;
  unit: string;
  icon: ReactNode;
  color: string;
  bgColor: string;
  progressColor: string;
  progressBgColor: string;
  textColor: string;
  borderColor: string;
}

export interface MicroNutrient {
  key: string;
  label: string;
  current: number;
  goal: number;
  weeklyGoal?: number;
  unit: string;
  icon: ReactNode;
  iconBg: string;
  color: string;
  status: string;
  statusBg: string;
  statusColor: string;
}

export interface MacroNutrients {
  protein: NutrientData;
  carbs: NutrientData;
  fats: NutrientData;
}

export interface MicroNutrients {
  sugar: NutrientData;
  fiber: NutrientData;
  sodium: NutrientData;
}

// ============================================================
// Nutrition list / search card (All Nutritions view)
// ============================================================

export interface Nutrition {
  id: number;
  name: string;
  unit: string;
  value: number;
  goal: number;
  type: string;
  trend?: number[];
  topSources?: string[];
}

// ============================================================
// All-nutrients API response (GET /food/nutrition/all)
// ============================================================

export interface TopFoodSource {
  name: string;
  amount: number;
  unit: string;
  contribution: number; // percentage
}

export interface AllNutrientSummary {
  id: string;
  name: string;
  unit: string;
  category: string; // macro | vitamin | mineral | other
  value: number; // avg daily intake over date range
  goal: number; // AI-derived RDI
  pctDV: number;
  flag: NutrientFlag;
  weeklyAvg: number;
  trend: number[];
  topSources: TopFoodSource[];
  pinned?: boolean;
  avoidedFoods?: string;
  customTarget?: number;
}

// ============================================================
// Detailed nutrient data (for drawer / detail view)
// ============================================================

export type NutrientFlag = 'low' | 'high' | 'none' | 'ok';

export interface NutrientDetailData {
  id: string;
  name: string;
  amount: number;
  unit: string;
  target?: number;
  pctDV: number;
  weeklyAvg?: number;
  flag: NutrientFlag;
  hasAvoidPreference?: boolean;
  trend: number[];
  topSources: string[];
  pinned?: boolean;
  recommendedValue?: number;
  currentTarget?: number;
}

export interface FoodSource {
  name: string;
  amount: number;
  unit: string;
  contribution: number;
}

// ============================================================
// Insights
// ============================================================

export type InsightVariant = 'positive' | 'negative' | 'neutral';

export interface Insight {
  variant: InsightVariant;
  message: string;
}

// ============================================================
// Weekly summary view model (weekly-summary components + hook)
// ============================================================

export type Status = 'good' | 'warn' | 'bad';
export type Direction = 'higher' | 'lower' | 'window';

export interface WeeklyNutrient {
  id: string;
  name: string;
  unit: string;
  amount: number;
  goal: number;
  dir: Direction;
  trend: number[];
  category?: string;
}
