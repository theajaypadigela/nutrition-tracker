import React from 'react';
import { View, Pressable } from 'react-native';
import { Edit2, Trash2 } from 'lucide-react-native';
import { Text } from './ui/text';

interface FoodItemProps {
  item: {
    id: string;
    name: string;
    quantity: string;
    servingSize: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  onEdit: () => void;
  onDelete: () => void;
}

export const FoodItem: React.FC<FoodItemProps> = ({
  item,
  onEdit,
  onDelete,
}) => {
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
          {item.quantity} {item.servingSize} • {item.calories} cal
        </Text>

        {/* Macros */}
        <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
          P: {item.protein}g • C: {item.carbs}g • F: {item.fat}g
        </Text>
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
