/**
 * Thin re-export: the nutrition domain types moved to src/types/nutrition.ts so
 * hooks no longer depend upward on component code. Kept for the many
 * nutrition-report component importers; new code should import from types/nutrition.
 */
export type {
  NutrientData,
  MacroNutrient,
  MicroNutrient,
  MacroNutrients,
  MicroNutrients,
  Nutrition,
  TopFoodSource,
  AllNutrientSummary,
  NutrientFlag,
  NutrientDetailData,
  FoodSource,
  InsightVariant,
  Insight,
} from '@/types/nutrition';
