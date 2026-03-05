import React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../ui/text';
import { VStack } from '../ui/vstack';
import { HStack } from '../ui/hstack';
import { ChevronDown, ChevronUp, Edit2, Trash2 } from 'lucide-react-native';
import { FoodItem } from './types';

interface MealGroupProps {
  mealType: string;
  items: FoodItem[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: (item: FoodItem) => void;
  onDelete: (mealType: string, itemId: string) => void;
}

export const MealGroup: React.FC<MealGroupProps> = ({
  mealType,
  items,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
}) => {
  if (items.length === 0) return null;

  const mealCalories = items.reduce((sum, item) => sum + (item.calories || 0), 0);

  const getMealIcon = (type: string) => {
    const lowerType = type.toLowerCase();
    switch (lowerType) {
      case 'breakfast':
        return '🌅';
      case 'lunch':
        return '☀️';
      case 'snack':
      case 'snacks':
        return '🍎';
      case 'dinner':
      default:
        return '🌙';
    }
  };

  // Capitalize first letter for display
  const displayMealType = mealType.charAt(0).toUpperCase() + mealType.slice(1);

  return (
    <View className="w-full rounded-2xl border border-gray-200 flex justify-between mb-4 bg-white">
      <Pressable onPress={onToggleExpand} style={{ width: '100%' }}>
        <HStack
          style={{
            width: '100%',
            padding: 24,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* left content — allow to grow */}
          <HStack
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              flex: 1,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#d1fae5',
              }}
            >
              <Text size="lg">{getMealIcon(mealType)}</Text>
            </View>

            <VStack style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{ fontWeight: '600', color: '#111827' }}
              >
                {displayMealType}
              </Text>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{ fontSize: 12, color: '#9CA3AF' }}
              >
                {items.length} {items.length === 1 ? 'item' : 'items'}
                {mealCalories > 0 && ` • ${mealCalories} cal`}
              </Text>
            </VStack>
          </HStack>

          {/* chevron should not overlap left content */}
          <View style={{ marginLeft: 12 }}>
            {isExpanded ? (
              <ChevronUp size={20} color="#6B7280" />
            ) : (
              <ChevronDown size={20} color="#6B7280" />
            )}
          </View>
        </HStack>
      </Pressable>

      {/* Expanded food items list */}
      {isExpanded && (
        <View
          style={{
            paddingHorizontal: 12,
            paddingBottom: 12,
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            paddingTop: 12,
          }}
        >
          {items.map(item => (
            <View
              key={item.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                borderRadius: 12,
                backgroundColor: '#F9FAFB',
                marginBottom: 8,
              }}
            >
              {/* Food item details */}
              <View style={{ flex: 1, minWidth: 0 }}>
                {/* Name and AI Logged badge */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: '#111827',
                    }}
                  >
                    {item.name}
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 9999,
                      backgroundColor: '#DBEAFE',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        color: '#3B82F6',
                        fontWeight: '500',
                      }}
                    >
                      AI Logged
                    </Text>
                  </View>
                </View>

                {/* Quantity and calories */}
                <Text
                  style={{
                    fontSize: 12,
                    color: '#6B7280',
                    marginBottom: 4,
                  }}
                >
                  {item.quantity} {item.servingSize}
                  {item.calories && ` • ${item.calories} cal`}
                </Text>

                {/* Macros - only show if available */}
                {(item.protein || item.carbs || item.fat) && (
                  <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
                    {item.protein !== undefined && `P: ${item.protein}g`}
                    {item.protein !== undefined && item.carbs !== undefined && ' • '}
                    {item.carbs !== undefined && `C: ${item.carbs}g`}
                    {item.carbs !== undefined && item.fat !== undefined && ' • '}
                    {item.fat !== undefined && `F: ${item.fat}g`}
                  </Text>
                )}
              </View>

              {/* Action buttons */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {/* Edit button */}
                <Pressable
                  onPress={() => onEdit(item)}
                  style={{
                    width: 36,
                    height: 36,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 18,
                    backgroundColor: '#DBEAFE',
                  }}
                >
                  <Edit2 size={15} color="#3B82F6" />
                </Pressable>

                {/* Delete button */}
                <Pressable
                  onPress={() => onDelete(mealType, item.id)}
                  style={{
                    width: 36,
                    height: 36,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 18,
                    backgroundColor: '#FEE2E2',
                  }}
                >
                  <Trash2 size={15} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};
