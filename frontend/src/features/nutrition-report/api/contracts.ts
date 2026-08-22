export type NutrientFlag = 'low' | 'high' | 'none' | 'ok';

export type InsightVariant = 'positive' | 'negative' | 'neutral';

export interface TopFoodSource {
  name: string;
  amount: number;
  unit: string;
  contribution: number;
}

export interface AllNutrientSummary {
  id: string;
  name: string;
  unit: string;
  category: string;
  value: number;
  goal: number;
  pctDV: number;
  flag: NutrientFlag;
  weeklyAvg: number;
  trend: number[];
  topSources: TopFoodSource[];
  pinned?: boolean;
  avoidedFoods?: string;
  customTarget?: number;
}
