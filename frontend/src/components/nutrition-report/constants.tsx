import React from 'react';
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
    icon: <Drumstick size={24} color="#3b82f6" />,
    color: '#3b82f6',
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
    icon: <Apple size={24} color="#f59e0b" />,
    color: '#f59e0b',
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
    icon: <Droplets size={24} color="#a855f7" />,
    color: '#a855f7',
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
    icon: <Cookie size={20} color="#f43f5e" />,
    iconBg: '#ffe4e6',
    color: '#be123c',
    status: 'Good ✓',
    statusBg: '#dcfce7',
    statusColor: '#15803d',
  },
  {
    key: 'fiber',
    label: 'Fiber',
    current: microNutrients.fiber.current,
    goal: microNutrients.fiber.goal,
    weeklyGoal: microNutrients.fiber.weeklyGoal,
    unit: 'g',
    icon: <Wheat size={20} color="#10b981" />,
    iconBg: '#dcfce7',
    color: '#15803d',
    status: 'Moderate',
    statusBg: '#fef3c7',
    statusColor: '#b45309',
  },
  {
    key: 'sodium',
    label: 'Sodium',
    current: microNutrients.sodium.current,
    goal: microNutrients.sodium.goal,
    weeklyGoal: microNutrients.sodium.weeklyGoal,
    unit: 'mg',
    icon: <Salad size={20} color="#f97316" />,
    iconBg: '#ffedd5',
    color: '#c2410c',
    status: 'High',
    statusBg: '#fef3c7',
    statusColor: '#b45309',
  },
];
