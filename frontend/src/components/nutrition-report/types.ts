import { ReactNode } from 'react';

export interface NutrientData {
  current: number;
  goal: number;
}

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
