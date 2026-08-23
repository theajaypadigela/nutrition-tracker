import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../ui/text';
import { ChevronDown, Edit2, Trash2, Plus, Zap } from 'lucide-react-native';
import { FoodItem } from './types';
import { tokens } from '@/theme/tokens';

const T = tokens.foodLog;

/** [surface, ink] tint pair per meal slot. */
const MEAL_TINTS: Record<string, [string, string]> = {
  breakfast: [T.amberSoft, T.amber],
  lunch: [T.greenSoft, T.good],
  snacks: [T.purpleSoft, T.purple],
  snack: [T.purpleSoft, T.purple],
  dinner: [T.blueSoft, T.blue],
};

const MEAL_ICONS: Record<string, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  snacks: '🍪',
  snack: '🍪',
  dinner: '🌙',
};

interface MealGroupProps {
  mealType: string;
  items: FoodItem[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: (item: FoodItem) => void;
  onDelete: (mealType: string, itemId: string) => void;
  onAdd?: (mealType: string) => void;
}

export const MealGroup: React.FC<MealGroupProps> = ({
  mealType,
  items,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAdd,
}) => {
  if (items.length === 0) return null;

  const key = mealType.toLowerCase();
  const tint = MEAL_TINTS[key] ?? [T.lineSoft, T.inkSoft];
  const icon = MEAL_ICONS[key] ?? '🍽️';
  const mealCalories = items.reduce((sum, item) => sum + (item.calories || 0), 0);
  const displayName = mealType.charAt(0).toUpperCase() + mealType.slice(1);

  return (
    <View style={styles.card}>
      {/* header */}
      <TouchableOpacity
        onPress={onToggleExpand}
        style={styles.header}
        activeOpacity={0.7}
      >
        <View style={[styles.mealIcon, { backgroundColor: tint[0] }]}>
          <Text style={styles.mealEmoji}>{icon}</Text>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.mealName}>{displayName}</Text>
          <Text style={styles.mealMeta} numberOfLines={1}>
            {items.length} {items.length === 1 ? 'item' : 'items'} ·{' '}
            {Math.round(mealCalories)} cal
          </Text>
        </View>

        <View style={styles.headerRight}>
          <View style={{ alignItems: 'flex-end', marginRight: 6 }}>
            <Text style={[styles.calCount, { color: tint[1] }]}>
              {Math.round(mealCalories)}
            </Text>
            <Text style={styles.calUnit}>KCAL</Text>
          </View>
          <View
            style={{
              transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
            }}
          >
            <ChevronDown size={18} color={T.inkMuted} strokeWidth={2.2} />
          </View>
        </View>
      </TouchableOpacity>

      {/* expanded items */}
      {isExpanded && (
        <View style={styles.body}>
          <View style={styles.divider} />
          <View style={styles.itemList}>
            {items.map((item, idx) => {
              const hasMacros =
                item.protein !== undefined ||
                item.carbs !== undefined ||
                item.fat !== undefined;

              return (
                <View key={item.id} style={styles.item}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {/* name + badge */}
                    <View style={styles.itemNameRow}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {/* All AI-logged for now; could be toggled by a field on FoodItem */}
                      <View style={styles.aiBadge}>
                        <Zap size={8} color={T.purple} fill={T.purple} />
                        <Text style={styles.aiBadgeText}>AI LOGGED</Text>
                      </View>
                    </View>

                    {/* qty + cal */}
                    <Text style={styles.itemMeta}>
                      {item.quantity} {item.servingSize}
                      {item.calories ? ` · ${item.calories} cal` : ''}
                    </Text>

                    {/* macros */}
                    {hasMacros && (
                      <Text style={styles.itemMacros}>
                        {item.protein !== undefined && `P ${fmtG(item.protein)}g`}
                        {item.protein !== undefined && item.carbs !== undefined && ' · '}
                        {item.carbs !== undefined && `C ${fmtG(item.carbs)}g`}
                        {item.carbs !== undefined && item.fat !== undefined && ' · '}
                        {item.fat !== undefined && `F ${fmtG(item.fat)}g`}
                      </Text>
                    )}
                  </View>

                  {/* action buttons */}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      onPress={() => onEdit(item)}
                      style={[styles.miniBtn, { backgroundColor: T.blueSoft }]}
                      activeOpacity={0.7}
                    >
                      <Edit2 size={15} color={T.blue} strokeWidth={2} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onDelete(mealType, item.id)}
                      style={[styles.miniBtn, { backgroundColor: T.lowSoft }]}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={15} color={T.low} strokeWidth={2} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>

          {/* add button */}
          {onAdd && (
            <TouchableOpacity
              onPress={() => onAdd(mealType)}
              style={styles.addBtn}
              activeOpacity={0.7}
            >
              <Plus size={15} color={T.green} strokeWidth={2.4} />
              <Text style={styles.addBtnText}>
                Add to {displayName.toLowerCase()}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

function fmtG(v: number): string {
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return (Math.round(v * 10) / 10).toString().replace(/\.0$/, '');
  return (Math.round(v * 10) / 10).toString();
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.line,
    overflow: 'hidden',
    shadowColor: T.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingHorizontal: 16,
  },
  mealIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  mealEmoji: {
    fontSize: 18,
  },
  mealName: {
    fontSize: 15.5,
    fontWeight: '800',
    color: T.ink,
    letterSpacing: -0.2,
  },
  mealMeta: {
    fontSize: 12,
    color: T.inkMuted,
    fontWeight: '600',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calCount: {
    fontSize: 15,
    fontWeight: '800',
  },
  calUnit: {
    fontSize: 10,
    color: T.inkMuted,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  body: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: T.lineSoft,
    marginHorizontal: 4,
    marginBottom: 10,
  },
  itemList: {
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: T.lineSoft,
    borderRadius: 14,
    padding: 11,
    paddingHorizontal: 12,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
    marginBottom: 3,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: T.ink,
    flexShrink: 1,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: T.purpleSoft,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
  },
  aiBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: T.purple,
    letterSpacing: 0.4,
  },
  itemMeta: {
    fontSize: 12,
    color: T.inkSoft,
    fontWeight: '600',
  },
  itemMacros: {
    fontSize: 11,
    color: T.inkMuted,
    fontWeight: '600',
    marginTop: 3,
  },
  actions: {
    gap: 6,
    flexShrink: 0,
  },
  miniBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    marginTop: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: T.line,
    borderRadius: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: T.green,
  },
});
