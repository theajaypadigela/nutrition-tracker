import React from 'react';
import { tokens } from '@/theme/tokens';
import {
  Apple,
  Droplets,
  Drumstick,
  Cookie,
  Wheat,
  Salad,
} from 'lucide-react-native';
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
    icon: <Drumstick size={24} color={tokens.macro.protein} />,
    color: tokens.macro.protein,
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
    icon: <Apple size={24} color={tokens.macro.carbs} />,
    color: tokens.macro.carbs,
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
    icon: <Droplets size={24} color={tokens.macro.fats} />,
    color: tokens.macro.fats,
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
    icon: <Cookie size={20} color={tokens.micro.sugar} />,
    iconBg: tokens.micro.sugarSurface,
    color: tokens.micro.sugarDeep,
    status: 'Good ✓',
    statusBg: tokens.micro.statusGoodSurface,
    statusColor: tokens.micro.statusGoodText,
  },
  {
    key: 'fiber',
    label: 'Fiber',
    current: microNutrients.fiber.current,
    goal: microNutrients.fiber.goal,
    weeklyGoal: microNutrients.fiber.weeklyGoal,
    unit: 'g',
    icon: <Wheat size={20} color={tokens.micro.fiber} />,
    iconBg: tokens.micro.fiberSurface,
    color: tokens.micro.fiberDeep,
    status: 'Moderate',
    statusBg: tokens.micro.statusWarnSurface,
    statusColor: tokens.micro.statusWarnText,
  },
  {
    key: 'sodium',
    label: 'Sodium',
    current: microNutrients.sodium.current,
    goal: microNutrients.sodium.goal,
    weeklyGoal: microNutrients.sodium.weeklyGoal,
    unit: 'mg',
    icon: <Salad size={20} color={tokens.micro.sodium} />,
    iconBg: tokens.micro.sodiumSurface,
    color: tokens.micro.sodiumDeep,
    status: 'High',
    statusBg: tokens.micro.statusWarnSurface,
    statusColor: tokens.micro.statusWarnText,
  },
];
