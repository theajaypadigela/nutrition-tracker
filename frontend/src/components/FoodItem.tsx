import React from 'react';
import { View, Pressable } from 'react-native';
import { Edit2, Trash2 } from 'lucide-react-native';
import { Text } from './ui/text';
import { FoodItem as FoodItemType } from '../types/types';
import { getEnrichmentPresentation } from '../features/food-log/enrichmentStatus';

interface FoodItemProps {
  item: FoodItemType;
  onEdit: () => void;
  onDelete: () => void;
}

export const FoodItem: React.FC<FoodItemProps> = ({
  item,
  onEdit,
  onDelete,
}) => {
  const enrichment = getEnrichmentPresentation(item.enrichmentStatus);

  return (
    <View
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
              backgroundColor: enrichment.backgroundColor,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                color: enrichment.textColor,
                fontWeight: '500',
              }}
            >
              {enrichment.label}
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
          {enrichment.showNutrition && item.calories !== undefined
            ? ` • ${item.calories} cal`
            : ''}
        </Text>

        {/* Macros */}
        {enrichment.showNutrition && (
          <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
            P: {item.protein}g • C: {item.carbs}g • F: {item.fat}g
          </Text>
        )}
      </View>

      {/* Action buttons */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {/* Edit button */}
        <Pressable
          onPress={onEdit}
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
          onPress={onDelete}
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
  );
};
