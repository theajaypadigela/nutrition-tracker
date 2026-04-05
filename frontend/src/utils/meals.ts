import { Meals, MealType } from '../types/types';

export const CANONICAL_MEAL_ORDER: MealType[] = [
  'breakfast',
  'lunch',
  'snack',
  'dinner',
];

const MEAL_ALIASES: Record<string, MealType> = {
  breakfast: 'breakfast',
  'break fast': 'breakfast',
  lunch: 'lunch',
  snack: 'snack',
  snacks: 'snack',
  dinner: 'dinner',
  supper: 'dinner',
};

export const normalizeMealType = (value?: string | null): MealType | null => {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

  if (MEAL_ALIASES[normalized]) {
    return MEAL_ALIASES[normalized];
  }

  if (normalized.includes('breakfast') || normalized.includes('break fast')) {
    return 'breakfast';
  }
  if (normalized.includes('lunch')) {
    return 'lunch';
  }
  if (normalized.includes('snack')) {
    return 'snack';
  }
  if (normalized.includes('dinner') || normalized.includes('supper')) {
    return 'dinner';
  }

  return null;
};

export const createEmptyMeals = (): Meals =>
  CANONICAL_MEAL_ORDER.reduce((acc, mealType) => {
    acc[mealType] = [];
    return acc;
  }, {} as Meals);

export const normalizeMeals = (meals?: Meals | null): Meals => {
  const normalizedMeals = createEmptyMeals();

  if (!meals) {
    return normalizedMeals;
  }

  Object.entries(meals).forEach(([mealType, items]) => {
    const normalizedMealType = normalizeMealType(mealType) ?? 'snack';
    normalizedMeals[normalizedMealType] = normalizedMeals[
      normalizedMealType
    ].concat(Array.isArray(items) ? items : []);
  });

  return normalizedMeals;
};
