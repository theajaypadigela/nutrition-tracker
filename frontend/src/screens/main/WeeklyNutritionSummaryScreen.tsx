import React from 'react';
import { tokens } from '@/theme/tokens';
import {
  View,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Text } from '@/components/ui/text';

import HeaderCard from '@/components/nutrition-report/weekly-summary/HeaderCard';
import NutrientRow from '@/components/nutrition-report/weekly-summary/NutrientRow';
import NutrientDetail from '@/components/nutrition-report/weekly-summary/NutrientDetail';
import GoalSheet from '@/components/nutrition-report/weekly-summary/GoalSheet';
import Toast from '@/components/nutrition-report/weekly-summary/Toast';
import {
  NutrientSearchBar,
  FilterChips,
  ValueModeToggle,
} from '@/components/nutrition-report/weekly-summary/FilterControls';
import {
  weekRangeLabel,
} from '@/components/nutrition-report/weekly-summary/tokens';
import { useWeeklyNutrientSummary } from '@/hooks/useWeeklyNutrientSummary';

const WeeklyNutritionSummaryScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const {
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
    setOpenId,
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
  } = useWeeklyNutrientSummary();

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
          onPrevWeek={goPrevWeek}
          onNextWeek={goNextWeek}
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
              <ActivityIndicator size="large" color={tokens.report.primary} />
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
    backgroundColor: tokens.report.bg,
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
    color: tokens.report.inkSoft,
    fontSize: 13,
    fontWeight: '500',
  },
  empty: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.report.line,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: tokens.report.surface,
    marginTop: 6,
  },
  emptyTitle: {
    color: tokens.report.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  emptySub: {
    color: tokens.report.inkMuted,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
});

export default WeeklyNutritionSummaryScreen;
