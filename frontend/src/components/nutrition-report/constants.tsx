import React from 'react';
import {
  Apple,
  Droplets,
  Drumstick,
  Cookie,
  Wheat,
  Salad,
} from 'lucide-react-native';
import { macroAccent, microAccent } from '../../theme/tokens';
import { MacroNutrient } from './types';

type NutrientInput = { current: number; goal: number; weeklyGoal?: number };

export const getMacroConfig = (
  protein: NutrientInput,
  carbs: NutrientInput,
  fats: NutrientInput,
): MacroNutrient[] => [
  {
    label: 'Protein',
    current: protein.current,
    goal: protein.goal,
    weeklyGoal: protein.weeklyGoal,
    unit: 'g',
    icon: <Drumstick size={24} color={macroAccent.protein} />,
    color: macroAccent.protein,
    bgColor: 'bg-blue-50',
    progressColor: 'bg-blue-500',
    progressBgColor: 'bg-blue-200',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-100',
  },
  {
    label: 'Carbs',
    current: carbs.current,
    goal: carbs.goal,
    weeklyGoal: carbs.weeklyGoal,
    unit: 'g',
    icon: <Apple size={24} color={macroAccent.carbs} />,
    color: macroAccent.carbs,
    bgColor: 'bg-amber-50',
    progressColor: 'bg-amber-500',
    progressBgColor: 'bg-amber-200',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-100',
  },
  {
    label: 'Fats',
    current: fats.current,
    goal: fats.goal,
    weeklyGoal: fats.weeklyGoal,
    unit: 'g',
    icon: <Droplets size={24} color={macroAccent.fats} />,
    color: macroAccent.fats,
    bgColor: 'bg-purple-50',
    progressColor: 'bg-purple-500',
    progressBgColor: 'bg-purple-200',
    textColor: 'text-purple-600',
    borderColor: 'border-purple-100',
  },
];

export const getMicroConfig = (microNutrients: {
  sugar: NutrientInput;
  fiber: NutrientInput;
  sodium: NutrientInput;
}) => [
  {
    key: 'sugar',
    label: 'Sugar',
    current: microNutrients.sugar.current,
    goal: microNutrients.sugar.goal,
    weeklyGoal: microNutrients.sugar.weeklyGoal,
    unit: 'g',
    icon: <Cookie size={20} color={microAccent.sugar} />,
    iconBg: microAccent.sugarSurface,
    color: microAccent.sugarDeep,
    status: 'Good ✓',
    statusBg: microAccent.statusGoodSurface,
    statusColor: microAccent.statusGoodText,
  },
  {
    key: 'fiber',
    label: 'Fiber',
    current: microNutrients.fiber.current,
    goal: microNutrients.fiber.goal,
    weeklyGoal: microNutrients.fiber.weeklyGoal,
    unit: 'g',
    icon: <Wheat size={20} color={microAccent.fiber} />,
    iconBg: microAccent.fiberSurface,
    color: microAccent.fiberDeep,
    status: 'Moderate',
    statusBg: microAccent.statusWarnSurface,
    statusColor: microAccent.statusWarnText,
  },
  {
    key: 'sodium',
    label: 'Sodium',
    current: microNutrients.sodium.current,
    goal: microNutrients.sodium.goal,
    weeklyGoal: microNutrients.sodium.weeklyGoal,
    unit: 'mg',
    icon: <Salad size={20} color={microAccent.sodium} />,
    iconBg: microAccent.sodiumSurface,
    color: microAccent.sodiumDeep,
    status: 'High',
    statusBg: microAccent.statusWarnSurface,
    statusColor: microAccent.statusWarnText,
  },
];
