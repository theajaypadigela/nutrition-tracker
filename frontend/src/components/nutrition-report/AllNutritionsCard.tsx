import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
  SectionList,
  StyleSheet,
} from 'react-native';
import { VStack } from '../ui/vstack';
import { HStack } from '../ui/hstack';
import { Text } from '../ui/text';
import SearchBar from '../ui/SearchBar';
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectInput,
  SelectIcon,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicatorWrapper,
  SelectDragIndicator,
} from '../ui/select';
import {
  ChevronDownIcon,
  Calendar as CalendarIcon,
  RefreshCw,
} from 'lucide-react-native';

import NutritionCard from './NutritionCard';
import NutritionDetailDrawer from './NutritionDetailDrawer';
import {
  AllNutrientSummary,
  NutrientDetailData,
  FoodSource,
  TopFoodSource,
} from './types';
import { nutritionApi } from '../../services/api/nutritionApi';
import {
  addDaysToLocalDate,
  formatLocalDate,
  parseLocalDateString,
} from '../../utils/date';

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────────────────────────────────────

const formatDateShort = (iso: string) => {
  const d = parseLocalDateString(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Calendar picker for custom date range
const PRESET_RANGES = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Custom range', days: -1 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const mapToDetailData = (item: AllNutrientSummary): NutrientDetailData => ({
  id: item.id,
  name: item.name,
  amount: item.value ?? item.weeklyAvg ?? 0,
  unit: item.unit,
  target: item.customTarget ?? item.goal,
  pctDV: item.pctDV,
  weeklyAvg: item.weeklyAvg,
  flag: item.flag,
  hasAvoidPreference: !!item.avoidedFoods,
  trend: item.trend,
  topSources: item.topSources.map(s => s.name),
  pinned: item.pinned ?? false,
  recommendedValue: item.goal,
  currentTarget: item.customTarget ?? item.goal,
});

const mapToFoodSources = (sources: TopFoodSource[]): FoodSource[] =>
  sources.map(s => ({
    name: s.name,
    amount: s.amount,
    unit: s.unit,
    contribution: s.contribution,
  }));

// ─────────────────────────────────────────────────────────────────────────────
// Extracted footer — must live outside AllNutritionsCard to satisfy the
// "no component definitions during render" lint rule.
// ─────────────────────────────────────────────────────────────────────────────
interface NutrientListFooterProps {
  loading: boolean;
  error: string | null;
  filteredCount: number;
  totalCount: number;
  onRetry: () => void;
  extraFooter?: React.ReactElement;
}

const NutrientListFooter: React.FC<NutrientListFooterProps> = ({
  loading,
  error,
  filteredCount,
  totalCount,
  onRetry,
  extraFooter,
}) => {
  let inner: React.ReactElement;

  if (loading) {
    inner = (
      <View className="mx-6 bg-white border-l border-r border-b border-gray-200 rounded-b-2xl mb-6 py-12 items-center justify-center">
        <ActivityIndicator size="small" color="#3b82f6" />
        <Text className="text-xs text-gray-400 mt-2">Loading nutrients…</Text>
      </View>
    );
  } else if (error) {
    inner = (
      <View className="mx-6 bg-white border-l border-r border-b border-gray-200 rounded-b-2xl mb-6 py-10 px-6 items-center">
        <Text className="text-sm text-red-500 font-semibold mb-1">
          Failed to load nutrients
        </Text>
        <Text className="text-xs text-gray-400 text-center mb-4">{error}</Text>
        <TouchableOpacity
          onPress={onRetry}
          className="bg-blue-500 px-4 py-2 rounded-lg"
        >
          <Text className="text-white text-xs font-semibold">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (filteredCount === 0) {
    inner = (
      <View className="mx-6 bg-white border-l border-r border-b border-gray-200 rounded-b-2xl mb-6 py-10 px-6 items-center">
        <Text className="text-sm text-gray-500 font-semibold">
          {totalCount === 0
            ? 'No nutrition data yet'
            : 'No nutrients match your filters'}
        </Text>
        <Text className="text-xs text-gray-400 text-center mt-1">
          {totalCount === 0
            ? 'Log some meals to see your nutrient breakdown here'
            : 'Try adjusting your search or filters'}
        </Text>
      </View>
    );
  } else {
    inner = (
      <View className="flex-row mx-6 bg-gray-50 border-l border-r border-b border-gray-200 rounded-b-2xl mb-6 px-4 py-3 justify-center items-center">
        <Text className="text-xs text-gray-400">End of nutrients list</Text>
      </View>
    );
  }

  return (
    <View>
      {inner}
      {extraFooter}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface AllNutritionsCardProps {
  listHeaderComponent?: React.ReactElement;
  ListFooterComponent?: React.ReactElement;
  refreshing?: boolean;
  onRefresh?: () => void;
}

const AllNutritionsCard: React.FC<AllNutritionsCardProps> = ({
  listHeaderComponent,
  ListFooterComponent,
  refreshing = false,
  onRefresh,
}) => {
  const [data, setData] = useState<AllNutrientSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nutrients, setNutrients] = useState<AllNutrientSummary[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Date range
  const [rangeDays, setRangeDays] = useState(7);
  const [startDate, setStartDate] = useState(() => {
    return formatLocalDate(addDaysToLocalDate(new Date(), -6));
  });
  const [endDate, setEndDate] = useState(() => formatLocalDate(new Date()));
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [customStartInput, setCustomStartInput] = useState('');
  const [customEndInput, setCustomEndInput] = useState('');

  // Drawer
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedNutrient, setSelectedNutrient] =
    useState<NutrientDetailData | null>(null);
  const [selectedSources, setSelectedSources] = useState<FoodSource[]>([]);
  const [selectedNutrientRaw, setSelectedNutrientRaw] =
    useState<AllNutrientSummary | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchNutrients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await nutritionApi.getAllNutrients({ startDate, endDate });
      setData(Array.isArray(result) ? result : []);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'An unexpected error occurred',
      );
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchNutrients();
  }, [fetchNutrients]);

  useEffect(() => {
    if (data) {
      setNutrients(data);
      if (selectedNutrientRaw) {
        const updatedRaw = data.find(n => n.id === selectedNutrientRaw.id);
        if (updatedRaw) {
          setSelectedNutrientRaw(updatedRaw);
          setSelectedNutrient(mapToDetailData(updatedRaw));
          setSelectedSources(mapToFoodSources(updatedRaw.topSources));
        }
      }
    }
  }, [data, selectedNutrientRaw]);

  // ── Date range handlers ────────────────────────────────────────────────────
  const handleSelectPresetRange = (days: number) => {
    if (days === -1) {
      // Custom: show date inputs
      setCustomStartInput(startDate);
      setCustomEndInput(endDate);
      setRangeDays(-1);
      return;
    }
    const end = new Date();
    const start = addDaysToLocalDate(end, -(days - 1));
    setStartDate(formatLocalDate(start));
    setEndDate(formatLocalDate(end));
    setRangeDays(days);
    setShowRangePicker(false);
  };

  const handleApplyCustomRange = () => {
    // Validate dates
    const s = new Date(customStartInput);
    const e = new Date(customEndInput);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      Alert.alert('Invalid Date', 'Please enter dates in YYYY-MM-DD format.');
      return;
    }
    if (s > e) {
      Alert.alert('Invalid Range', 'Start date must be before end date.');
      return;
    }
    setStartDate(customStartInput);
    setEndDate(customEndInput);
    setRangeDays(-1);
    setShowRangePicker(false);
  };

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return nutrients.filter(n => {
      const matchesSearch =
        searchQuery === '' ||
        n.name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === 'all' ||
        n.category.toLowerCase() === selectedCategory.toLowerCase() ||
        (selectedCategory === 'others' &&
          !['macro', 'vitamin', 'mineral'].includes(n.category.toLowerCase()));

      const matchesStatus =
        selectedStatus === 'all' || n.flag === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [nutrients, searchQuery, selectedCategory, selectedStatus]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleOpenDrawer = (item: AllNutrientSummary) => {
    setSelectedNutrientRaw(item);
    setSelectedNutrient(mapToDetailData(item));
    setSelectedSources(mapToFoodSources(item.topSources));
    setShowDrawer(true);
  };

  // Pin handler
  const handlePin = async (nutrientId: string) => {
    try {
      await nutritionApi.pinNutrient(nutrientId);
      // Update local state
      setNutrients(prev =>
        prev.map(n => (n.id === nutrientId ? { ...n, pinned: !n.pinned } : n)),
      );
      // Update drawer state
      if (selectedNutrient?.id === nutrientId) {
        setSelectedNutrient(prev =>
          prev ? { ...prev, pinned: !prev.pinned } : prev,
        );
      }
    } catch (err) {
      console.error('Error toggling pin:', err);
    }
  };

  // Set Target handler
  const handleSetTarget = async (nutrientId: string, value: string) => {
    try {
      const target = parseFloat(value);
      if (isNaN(target) || target <= 0) return;

      await nutritionApi.setNutrientTarget(nutrientId, target);
      // Refresh nutrients to get recalculated pctDV/flag
      fetchNutrients();
    } catch (err) {
      console.error('Error setting target:', err);
    }
  };

  // Mark Avoid handler
  const handleMarkAvoid = (nutrientId: string) => {
    const currentAvoided =
      nutrients.find(n => n.id === nutrientId)?.avoidedFoods || '';
    Alert.prompt(
      'Mark Foods to Avoid',
      'Enter food names separated by commas (e.g. soda, cake, candy):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (text?: string) => {
            if (!text) return;
            const foods = text
              .split(',')
              .map(f => f.trim())
              .filter(f => f.length > 0);
            try {
              await nutritionApi.markNutrientAvoid(nutrientId, foods);
              setNutrients(prev =>
                prev.map(n =>
                  n.id === nutrientId
                    ? { ...n, avoidedFoods: foods.join(',') }
                    : n,
                ),
              );
            } catch (err) {
              console.error('Error setting avoided foods:', err);
            }
          },
        },
      ],
      'plain-text',
      currentAvoided,
    );
  };

  // Get the date range label
  const dateRangeLabel =
    rangeDays > 0
      ? `Last ${rangeDays}d`
      : `${formatDateShort(startDate)} - ${formatDateShort(endDate)}`;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <SectionList
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          <>
            {listHeaderComponent}
            <View className="mx-6 mt-6 bg-white rounded-t-2xl border-t border-l border-r border-gray-200 overflow-hidden">
              <HStack className="items-center justify-between px-4 pt-4 pb-2">
                <Text size="md" className="font-bold text-gray-800">
                  All Nutrients
                </Text>
                <HStack className="gap-2 items-center">
                  {/* Date range selector */}
                  <TouchableOpacity
                    onPress={() => setShowRangePicker(v => !v)}
                    className="flex-row items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg"
                  >
                    <CalendarIcon size={13} color="#3b82f6" />
                    <Text className="text-xs font-semibold text-blue-600">
                      {dateRangeLabel}
                    </Text>
                  </TouchableOpacity>
                  {/* Refresh */}
                  <TouchableOpacity
                    onPress={fetchNutrients}
                    className="p-1.5 bg-gray-100 rounded-lg"
                  >
                    <RefreshCw size={14} color="#6b7280" />
                  </TouchableOpacity>
                </HStack>
              </HStack>

              {/* Range picker dropdown */}
              {showRangePicker && (
                <VStack className="mx-4 mb-2 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  {PRESET_RANGES.map(preset => (
                    <TouchableOpacity
                      key={preset.days}
                      onPress={() => handleSelectPresetRange(preset.days)}
                      className={`px-4 py-2.5 border-b border-gray-100 ${
                        rangeDays === preset.days ? 'bg-blue-50' : ''
                      }`}
                    >
                      <Text
                        className={`text-sm ${
                          rangeDays === preset.days
                            ? 'text-blue-600 font-semibold'
                            : 'text-gray-700'
                        }`}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  ))}

                  {/* Custom date inputs */}
                  {rangeDays === -1 && (
                    <VStack className="p-3 gap-2 border-t border-gray-200 bg-gray-50">
                      <HStack className="gap-2 items-center">
                        <Text className="text-xs text-gray-500 w-12">
                          From:
                        </Text>
                        <TextInput
                          value={customStartInput}
                          onChangeText={setCustomStartInput}
                          placeholder="YYYY-MM-DD"
                          className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
                          style={styles.textInputFont}
                        />
                      </HStack>
                      <HStack className="gap-2 items-center">
                        <Text className="text-xs text-gray-500 w-12">To:</Text>
                        <TextInput
                          value={customEndInput}
                          onChangeText={setCustomEndInput}
                          placeholder="YYYY-MM-DD"
                          className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
                          style={styles.textInputFont}
                        />
                      </HStack>
                      <TouchableOpacity
                        onPress={handleApplyCustomRange}
                        className="bg-blue-500 rounded-lg py-2 items-center mt-1"
                      >
                        <Text className="text-white text-sm font-semibold">
                          Apply Range
                        </Text>
                      </TouchableOpacity>
                    </VStack>
                  )}
                </VStack>
              )}
            </View>
          </>
        }
        stickySectionHeadersEnabled={true}
        sections={[{ title: 'filters', data: filtered }]}
        renderSectionHeader={() => (
          <View className="mx-6 bg-gray-50 border-l border-r border-b border-gray-200 z-10">
            <VStack className="gap-3 px-4 pb-3 pt-3">
              <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
              <View className="flex-row">
                {/* Category filter */}
                <Select
                  className="flex-1 pr-1"
                  selectedValue={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger
                    className="bg-white"
                    variant="outline"
                    size="md"
                  >
                    <SelectInput placeholder="Category" />
                    <SelectIcon className="mr-3" as={ChevronDownIcon} />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdrop />
                    <SelectContent>
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      <SelectItem label="All Categories" value="all" />
                      <SelectItem label="Macros" value="macro" />
                      <SelectItem label="Vitamins" value="vitamin" />
                      <SelectItem label="Minerals" value="mineral" />
                      <SelectItem label="Others" value="others" />
                    </SelectContent>
                  </SelectPortal>
                </Select>

                {/* Status filter */}
                <Select
                  className="flex-1 pl-1"
                  selectedValue={selectedStatus}
                  onValueChange={setSelectedStatus}
                >
                  <SelectTrigger
                    className="bg-white"
                    variant="outline"
                    size="md"
                  >
                    <SelectInput placeholder="Status" />
                    <SelectIcon className="mr-3" as={ChevronDownIcon} />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdrop />
                    <SelectContent>
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      <SelectItem label="All Status" value="all" />
                      <SelectItem label="Low (< 80%)" value="low" />
                      <SelectItem label="Optimal (80–120%)" value="ok" />
                      <SelectItem label="High (> 120%)" value="high" />
                      <SelectItem label="No Target" value="none" />
                    </SelectContent>
                  </SelectPortal>
                </Select>
              </View>
            </VStack>
          </View>
        )}
        renderItem={({ item, index }) => {
          const isLast = index === filtered.length - 1;
          const isOnlyFooter = !(loading || error || filtered.length === 0);
          const needsRoundBottom = isLast && isOnlyFooter;

          return (
            <View
              className={`bg-white mx-6 border-l border-r border-gray-200 ${needsRoundBottom ? 'rounded-b-2xl border-b mb-6 pb-2' : ''}`}
            >
              <NutritionCard
                id={index + 1}
                name={item.name}
                unit={item.unit}
                value={item.value ?? item.weeklyAvg ?? 0}
                goal={item.customTarget ?? item.goal}
                type={item.category}
                flag={item.flag}
                pctDV={item.pctDV}
                pinned={item.pinned}
                onPress={() => handleOpenDrawer(item)}
              />
            </View>
          );
        }}
        ListFooterComponent={
          <NutrientListFooter
            loading={loading}
            error={error}
            filteredCount={filtered.length}
            totalCount={nutrients.length}
            onRetry={fetchNutrients}
            extraFooter={ListFooterComponent}
          />
        }
      />

      {/* Detail drawer */}
      <NutritionDetailDrawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        selectedNutrient={selectedNutrient}
        nutrientBreakdown={selectedSources}
        onPin={handlePin}
        onSetTarget={(nutrientId: string, value: string) =>
          handleSetTarget(nutrientId, value)
        }
        onMarkAvoid={() => {
          if (selectedNutrient) {
            setShowDrawer(false);
            setTimeout(() => handleMarkAvoid(selectedNutrient.id), 300);
          }
        }}
      />
    </>
  );
};

export default AllNutritionsCard;

const styles = StyleSheet.create({
  textInputFont: {
    fontSize: 14,
  },
});
