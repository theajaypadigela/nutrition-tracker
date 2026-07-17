import { useCallback, useEffect, useMemo, useState } from 'react';
import { nutritionApi } from '../services/api/nutritionApi';
import { AllNutrientSummary, Status, WeeklyNutrient } from '../types/nutrition';
import {
  inferDirection,
  scoreOf,
  statusOf,
} from '../components/nutrition-report/weekly-summary/tokens';
import { getMondayWeekRange } from '../utils/weekRange';

export type FilterValue = 'all' | Status;

/** Pure transform from a raw API nutrient summary into the weekly-summary view model. */
export const buildWeeklyNutrient = (
  raw: AllNutrientSummary,
  goalOverride?: number,
): WeeklyNutrient => {
  const trend =
    Array.isArray(raw.trend) && raw.trend.length > 0 ? raw.trend.slice(0, 7) : [];
  const padded = [...trend];
  while (padded.length < 7) padded.push(0);
  const trendSum = padded.reduce((a, b) => a + b, 0);
  const dailyAvg = raw.value ?? raw.weeklyAvg ?? 0;
  const amount = trendSum > 0 ? trendSum : dailyAvg * 7;
  const dailyGoal = raw.customTarget ?? raw.goal ?? 0;
  const baseWeeklyGoal = dailyGoal * 7;
  return {
    id: raw.id,
    name: raw.name,
    unit: raw.unit,
    amount,
    goal: goalOverride ?? baseWeeklyGoal,
    dir: inferDirection(raw.name, raw.category),
    trend: padded,
    category: raw.category,
  };
};

/**
 * Owns the weekly all-nutrients summary: week navigation + data fetch (nutritionApi),
 * the search/filter/value-mode UI state, derived summary/counts/filtered lists, the
 * open detail + goal-sheet selection, and saving a custom goal. The screen renders from it.
 */
export function useWeeklyNutrientSummary() {
  const [data, setData] = useState<AllNutrientSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [weekIdx, setWeekIdx] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');
  const [valueMode, setValueMode] = useState<'absolute' | 'percent'>('absolute');
  const [openId, setOpenId] = useState<string | null>(null);
  const [goalSheetId, setGoalSheetId] = useState<string | null>(null);
  const [goalOverrides, setGoalOverrides] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const dateRange = useMemo(() => getMondayWeekRange(weekIdx), [weekIdx]);

  const fetchNutrients = useCallback(async () => {
    setLoading(true);
    try {
      const result = await nutritionApi.getAllNutrients(dateRange);
      setData(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error('Failed to load weekly nutrient data:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchNutrients();
  }, [fetchNutrients]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNutrients();
    setRefreshing(false);
  }, [fetchNutrients]);

  const allNutrients = useMemo<WeeklyNutrient[]>(() => {
    if (!Array.isArray(data)) return [];
    return data.map(raw => buildWeeklyNutrient(raw, goalOverrides[raw.id]));
  }, [data, goalOverrides]);

  const summary = useMemo(() => {
    const score = scoreOf(allNutrients);
    let onTrack = 0;
    let tracked = 0;
    allNutrients.forEach(n => {
      const s = statusOf(n);
      if (n.amount > 0) tracked++;
      if (s === 'good') onTrack++;
    });
    const hitRate = allNutrients.length
      ? Math.round((onTrack / allNutrients.length) * 100)
      : 0;
    return { score, onTrack, tracked, hitRate };
  }, [allNutrients]);

  const counts = useMemo(() => {
    const acc = { all: allNutrients.length, good: 0, warn: 0, bad: 0 };
    allNutrients.forEach(n => {
      acc[statusOf(n)]++;
    });
    return acc;
  }, [allNutrients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allNutrients.filter(n => {
      const matchesQuery = q === '' || n.name.toLowerCase().includes(q);
      const matchesFilter = filter === 'all' || statusOf(n) === filter;
      return matchesQuery && matchesFilter;
    });
  }, [allNutrients, query, filter]);

  const detailNutrient = useMemo(
    () => allNutrients.find(n => n.id === openId) ?? null,
    [allNutrients, openId],
  );
  const goalSheetNutrient = useMemo(
    () => allNutrients.find(n => n.id === goalSheetId) ?? null,
    [allNutrients, goalSheetId],
  );

  const goPrevWeek = useCallback(() => setWeekIdx(w => w - 1), []);
  const goNextWeek = useCallback(() => setWeekIdx(w => Math.min(0, w + 1)), []);

  const handleSaveGoal = useCallback(
    async (newWeeklyGoal: number) => {
      if (!goalSheetNutrient) return;
      const id = goalSheetNutrient.id;
      const newDailyTarget = newWeeklyGoal / 7;
      setGoalOverrides(prev => ({ ...prev, [id]: newWeeklyGoal }));
      setGoalSheetId(null);
      setToast(`Goal updated for ${goalSheetNutrient.name}`);
      try {
        await nutritionApi.setNutrientTarget(id, Number(newDailyTarget.toFixed(2)));
        fetchNutrients();
      } catch (err) {
        console.error('Failed to update target:', err);
      }
    },
    [goalSheetNutrient, fetchNutrients],
  );

  return {
    loading,
    refreshing,
    onRefresh,
    weekIdx,
    goPrevWeek,
    goNextWeek,
    query,
    setQuery,
    filter,
    setFilter,
    valueMode,
    setValueMode,
    openId,
    setOpenId,
    goalSheetId,
    setGoalSheetId,
    toast,
    setToast,
    allNutrients,
    summary,
    counts,
    filtered,
    detailNutrient,
    goalSheetNutrient,
    handleSaveGoal,
  };
}
