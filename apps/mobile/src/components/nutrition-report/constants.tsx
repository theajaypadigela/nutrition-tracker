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

export const getMacroConfig = (
  protein: { current: number; goal: number },
  carbs: { current: number; goal: number },
  fats: { current: number; goal: number },
): MacroNutrient[] => [
  {
    label: 'Protein',
    current: protein.current,
    goal: protein.goal,
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
  sugar: { current: number; goal: number };
  fiber: { current: number; goal: number };
  sodium: { current: number; goal: number };
}) => [
  {
    key: 'sugar',
    label: 'Sugar',
    current: microNutrients.sugar.current,
    goal: microNutrients.sugar.goal,
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
    unit: 'mg',
    icon: <Salad size={20} color="#f97316" />,
    iconBg: '#ffedd5',
    color: '#c2410c',
    status: 'High',
    statusBg: '#fef3c7',
    statusColor: '#b45309',
  },
];
