import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  View,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Text } from '../../components/ui/text';

import HeaderCard from '../../components/nutrition-report/weekly-summary/HeaderCard';
import NutrientRow from '../../components/nutrition-report/weekly-summary/NutrientRow';
import NutrientDetail from '../../components/nutrition-report/weekly-summary/NutrientDetail';
import GoalSheet from '../../components/nutrition-report/weekly-summary/GoalSheet';
import Toast from '../../components/nutrition-report/weekly-summary/Toast';
import {
  NutrientSearchBar,
  FilterChips,
  ValueModeToggle,
} from '../../components/nutrition-report/weekly-summary/FilterControls';
import {
  WeeklyNutrient,
  Status,
  inferDirection,
  scoreOf,
  statusOf,
  tokens,
  weekRangeLabel,
} from '../../components/nutrition-report/weekly-summary/tokens';

import useApi from '../../hooks/useApi';
import { AllNutrientSummary } from '../../components/nutrition-report/types';
import { formatLocalDate } from '../../utils/date';

type FilterValue = 'all' | Status;

const buildWeeklyNutrient = (
  raw: AllNutrientSummary,
  goalOverride?: number,
): WeeklyNutrient => {
  const trend =
    Array.isArray(raw.trend) && raw.trend.length > 0
      ? raw.trend.slice(0, 7)
      : [];
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

const WeeklyNutritionSummaryScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { data, request, loading } = useApi<AllNutrientSummary[]>();
  const targetApi = useApi();

  const [weekIdx, setWeekIdx] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');
  const [valueMode, setValueMode] = useState<'absolute' | 'percent'>(
    'absolute',
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [goalSheetId, setGoalSheetId] = useState<string | null>(null);
  const [goalOverrides, setGoalOverrides] = useState<Record<string, number>>(
    {},
  );
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const dateRange = useMemo(() => {
    const today = new Date();
    const day = today.getDay();
    const offsetToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + offsetToMon + weekIdx * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      startDate: formatLocalDate(monday),
      endDate: formatLocalDate(sunday),
    };
  }, [weekIdx]);

  const fetchNutrients = useCallback(async () => {
    try {
      await request({
        url: `/food/nutrition/all?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
        method: 'GET',
      });
    } catch (err) {
      console.error('Failed to load weekly nutrient data:', err);
    }
  }, [request, dateRange.startDate, dateRange.endDate]);

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
      const s = statusOf(n);
      acc[s]++;
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

  const handleSaveGoal = useCallback(
    async (newWeeklyGoal: number) => {
      if (!goalSheetNutrient) return;
      const id = goalSheetNutrient.id;
      const newDailyTarget = newWeeklyGoal / 7;
      setGoalOverrides(prev => ({ ...prev, [id]: newWeeklyGoal }));
      setGoalSheetId(null);
      setToast(`Goal updated for ${goalSheetNutrient.name}`);
      try {
        await targetApi.request({
          url: `/food/nutrient/${id}/target`,
          method: 'PUT',
          data: { target: Number(newDailyTarget.toFixed(2)) },
        });
        fetchNutrients();
      } catch (err) {
        console.error('Failed to update target:', err);
      }
    },
    [goalSheetNutrient, targetApi, fetchNutrients],
  );

  const handleBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };

  if (detailNutrient) {
    return (
      <>
        <View style={styles.root}>
          <NutrientDetail
            nutrient={detailNutrient}
            statusBarInset={insets.top}
            onBack={() => setOpenId(null)}
            onSetGoal={() => setGoalSheetId(detailNutrient.id)}
          />
        </View>
        <GoalSheet
          visible={!!goalSheetNutrient}
          nutrient={goalSheetNutrient}
          baseGoal={goalSheetNutrient?.goal ?? 0}
          onClose={() => setGoalSheetId(null)}
          onSave={handleSaveGoal}
        />
        <Toast message={toast} onHide={() => setToast(null)} />
      </>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 120 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <HeaderCard
          statusBarInset={insets.top}
          weekLabel={weekRangeLabel(weekIdx)}
          weekIdx={weekIdx}
          onPrevWeek={() => setWeekIdx(w => w - 1)}
          onNextWeek={() => setWeekIdx(w => Math.min(0, w + 1))}
          onBack={handleBack}
          score={summary.score}
          onTrack={summary.onTrack}
          tracked={summary.tracked}
          hitRate={summary.hitRate}
        />

        <View style={styles.body}>
          <NutrientSearchBar value={query} onChange={setQuery} />

          <View style={styles.chipsRow}>
            <FilterChips
              value={filter}
              counts={counts}
              onChange={setFilter}
            />
          </View>

          <ValueModeToggle
            count={filtered.length}
            mode={valueMode}
            onChange={setValueMode}
          />

          {loading && allNutrients.length === 0 ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={tokens.primary} />
              <Text style={styles.loadingText}>Loading nutrients…</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No matches</Text>
              <Text style={styles.emptySub}>
                {query
                  ? 'Try a different search.'
                  : 'No nutrients tracked for this week yet.'}
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {filtered.map(n => (
                <NutrientRow
                  key={n.id}
                  nutrient={n}
                  valueMode={valueMode}
                  onPress={() => setOpenId(n.id)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <GoalSheet
        visible={!!goalSheetNutrient}
        nutrient={goalSheetNutrient}
        baseGoal={goalSheetNutrient?.goal ?? 0}
        onClose={() => setGoalSheetId(null)}
        onSave={handleSaveGoal}
      />
      <Toast message={toast} onHide={() => setToast(null)} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.bg,
  },
  fill: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  chipsRow: {
    marginHorizontal: -16,
    paddingLeft: 16,
  },
  list: {
    gap: 10,
    marginTop: 4,
  },
  loading: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: tokens.inkSoft,
    fontSize: 13,
    fontWeight: '500',
  },
  empty: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.line,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: tokens.surface,
    marginTop: 6,
  },
  emptyTitle: {
    color: tokens.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  emptySub: {
    color: tokens.inkMuted,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
});

export default WeeklyNutritionSummaryScreen;
