import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Search, X, SlidersHorizontal } from 'lucide-react-native';
import { Text } from '../../ui/text';
import { tokens, Status } from './tokens';

type FilterValue = 'all' | Status;
type ValueMode = 'absolute' | 'percent';

interface SearchProps {
  value: string;
  onChange: (v: string) => void;
}

export const NutrientSearchBar: React.FC<SearchProps> = ({
  value,
  onChange,
}) => {
  const showClear = value.length > 0;
  return (
    <View style={searchStyles.wrap}>
      <Search size={16} color={tokens.inkMuted} strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search vitamins, minerals, macros…"
        placeholderTextColor={tokens.inkMuted}
        style={searchStyles.input}
        returnKeyType="search"
      />
      {showClear ? (
        <TouchableOpacity
          onPress={() => onChange('')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X size={16} color={tokens.inkMuted} strokeWidth={2.4} />
        </TouchableOpacity>
      ) : (
        <SlidersHorizontal size={16} color={tokens.inkMuted} strokeWidth={2} />
      )}
    </View>
  );
};

const searchStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  input: {
    flex: 1,
    color: tokens.ink,
    fontSize: 14,
    fontWeight: '500',
    padding: 0,
  },
});

interface ChipsProps {
  value: FilterValue;
  counts: { all: number; good: number; warn: number; bad: number };
  onChange: (v: FilterValue) => void;
}

const CHIP_DEFS: Array<{
  key: FilterValue;
  label: string;
  dot?: string;
}> = [
  { key: 'all', label: 'All' },
  { key: 'good', label: 'On track', dot: tokens.good },
  { key: 'warn', label: 'Close', dot: tokens.warn },
  { key: 'bad', label: 'Off goal', dot: tokens.bad },
];

export const FilterChips: React.FC<ChipsProps> = ({
  value,
  counts,
  onChange,
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={chipStyles.row}
    >
      {CHIP_DEFS.map(c => {
        const active = value === c.key;
        const count = counts[c.key];
        return (
          <TouchableOpacity
            key={c.key}
            onPress={() => onChange(c.key)}
            style={[chipStyles.chip, active && chipStyles.chipActive]}
            activeOpacity={0.85}
          >
            {c.dot && (
              <View
                style={[chipStyles.dot, { backgroundColor: c.dot }]}
              />
            )}
            <Text
              style={[chipStyles.label, active && chipStyles.labelActive]}
            >
              {c.label}
            </Text>
            <Text
              style={[chipStyles.count, active && chipStyles.countActive]}
            >
              {count}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const chipStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: tokens.primarySoft,
    borderColor: tokens.primary,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    color: tokens.inkSoft,
    fontSize: 12,
    fontWeight: '600',
  },
  labelActive: {
    color: tokens.primaryDeep,
    fontWeight: '700',
  },
  count: {
    color: tokens.inkMuted,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 2,
  },
  countActive: {
    color: tokens.primaryDeep,
    fontWeight: '700',
  },
});

interface ValueToggleProps {
  count: number;
  mode: ValueMode;
  onChange: (m: ValueMode) => void;
}

export const ValueModeToggle: React.FC<ValueToggleProps> = ({
  count,
  mode,
  onChange,
}) => {
  return (
    <View style={toggleStyles.wrap}>
      <Text style={toggleStyles.count}>
        {count} {count === 1 ? 'nutrient' : 'nutrients'}
      </Text>
      <View style={toggleStyles.toggle}>
        <TouchableOpacity
          onPress={() => onChange('absolute')}
          style={[
            toggleStyles.opt,
            mode === 'absolute' && toggleStyles.optActive,
          ]}
        >
          <Text
            style={[
              toggleStyles.optText,
              mode === 'absolute' && toggleStyles.optTextActive,
            ]}
          >
            Amount
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onChange('percent')}
          style={[
            toggleStyles.opt,
            mode === 'percent' && toggleStyles.optActive,
          ]}
        >
          <Text
            style={[
              toggleStyles.optText,
              mode === 'percent' && toggleStyles.optTextActive,
            ]}
          >
            %
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const toggleStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  count: {
    color: tokens.inkSoft,
    fontSize: 12,
    fontWeight: '600',
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: tokens.lineSoft,
    borderRadius: 999,
    padding: 3,
  },
  opt: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  optActive: {
    backgroundColor: tokens.surface,
    shadowColor: '#0f1e28',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  optText: {
    color: tokens.inkSoft,
    fontSize: 12,
    fontWeight: '600',
  },
  optTextActive: {
    color: tokens.ink,
    fontWeight: '700',
  },
});
