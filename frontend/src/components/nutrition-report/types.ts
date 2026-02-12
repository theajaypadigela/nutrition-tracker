import { ReactNode } from 'react';

// ============================================================
// Simple current/goal pair — used by macro & micro summary cards
// ============================================================

export interface NutrientData {
  current: number;
  goal: number;
}

// ============================================================
// Macro / Micro display models
// ============================================================

export interface MacroNutrient {
  label: string;
  current: number;
  goal: number;
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
