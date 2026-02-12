import React, { useState } from 'react';
import { Text } from '../../components/ui/text';
import { VStack } from '../../components/ui/vstack';
import { MealGroup } from '../../components/food-log/MealGroup';
import { EditFoodDrawer } from '../../components/food-log/EditFoodDrawer';
import { FoodItem, Meals } from '../../components/food-log/types';
import NutritionDisplay from '../../components/food-log/NutritionDisplay';
import { ScrollView } from 'react-native';

const FoodLogScreen = () => {
  const [expandedMeal, setExpandedMeal] = useState<string | null>('Breakfast');
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);

  const [meals, setMeals] = useState<Meals>({
    Breakfast: [
      {
        id: '1',
        name: 'Oatmeal with Berries',
        quantity: '1',
        servingSize: 'bowl',
        calories: 320,
        protein: 12,
        carbs: 54,
        fat: 8,
      },
      {
        id: '2',
        name: 'Greek Yogurt',
        quantity: '1',
        servingSize: 'cup',
        calories: 150,
        protein: 20,
        carbs: 8,
        fat: 4,
      },
    ],
    Lunch: [
      {
        id: '3',
        name: 'Grilled Chicken Salad',
        quantity: '1',
        servingSize: 'plate',
        calories: 450,
        protein: 38,
        carbs: 22,
        fat: 18,
      },
      {
        id: '4',
        name: 'Apple',
        quantity: '1',
        servingSize: 'medium',
        calories: 95,
        protein: 0,
        carbs: 25,
        fat: 0,
      },
    ],
    Snacks: [
      {
        id: '5',
        name: 'Mixed Nuts',
        quantity: '1',
        servingSize: 'handful',
        calories: 180,
        protein: 6,
        carbs: 8,
        fat: 15,
      },
      {
        id: '6',
        name: 'Protein Bar',
        quantity: '1',
        servingSize: 'bar',
        calories: 200,
        protein: 20,
        carbs: 24,
        fat: 7,
      },
    ],
    Dinner: [
      {
        id: '7',
        name: 'Salmon with Vegetables',
        quantity: '1',
        servingSize: 'serving',
        calories: 520,
        protein: 42,
        carbs: 18,
        fat: 28,
      },
      {
        id: '8',
        name: 'Quinoa',
        quantity: '1',
        servingSize: 'cup',
        calories: 220,
        protein: 8,
        carbs: 40,
        fat: 4,
      },
    ],
  });

  const handleEditFood = (item: FoodItem) => {
    setSelectedFood(item);
    setShowDrawer(true);
  };

  const handleSaveFood = (
    name: string,
    quantity: string,
    servingSize: string,
  ) => {
    if (!selectedFood) return;

    // Find which meal the food belongs to and update it
    const newMeals = { ...meals };

    for (const [mealType, items] of Object.entries(newMeals)) {
      const itemIndex = items.findIndex(
        (item: FoodItem) => item.id === selectedFood.id,
      );
      if (itemIndex !== -1) {
        newMeals[mealType] = [
          ...items.slice(0, itemIndex),
          { ...items[itemIndex], name, quantity, servingSize },
          ...items.slice(itemIndex + 1),
        ];
        break;
      }
    }

    setMeals(newMeals);
    setShowDrawer(false);
    setSelectedFood(null);
  };

  const handleDeleteFood = (mealType: string, itemId: string) => {
    const newMeals = { ...meals };
    newMeals[mealType] = newMeals[mealType].filter(
      (item: FoodItem) => item.id !== itemId,
    );
    setMeals(newMeals);
  };

  return (
    <ScrollView>
      <VStack className="w-full p-6 mb-10">
        <VStack>
          <Text size="md" className="font-bold text-gray-500">
            MEAL BREAKDOWN
          </Text>
          {Object.entries(meals).map(([mealType, items]) => (
            <MealGroup
              key={mealType}
              mealType={mealType}
              items={items}
              isExpanded={expandedMeal === mealType}
              onToggleExpand={() =>
                setExpandedMeal(expandedMeal === mealType ? null : mealType)
              }
              onEdit={handleEditFood}
              onDelete={handleDeleteFood}
            />
          ))}
        </VStack>
        <NutritionDisplay
          calories={Object.values(meals)
            .flat()
            .reduce((acc, item) => acc + item.calories, 0)}
          targetCalories={2500}
          totals={{
            protein: Object.values(meals)
              .flat()
              .reduce((acc, item) => acc + item.protein, 0),
            carbs: Object.values(meals)
              .flat()
              .reduce((acc, item) => acc + item.carbs, 0),
            fat: Object.values(meals)
              .flat()
              .reduce((acc, item) => acc + item.fat, 0),
            sugar: 40,
          }}
          dailyGoals={{
            protein: 180,
            carbs: 250,
            fat: 70,
            sugar: 40,
          }}
        />
      </VStack>
      <EditFoodDrawer
        isOpen={showDrawer}
        onClose={() => {
          setShowDrawer(false);
          setSelectedFood(null);
        }}
        onSave={handleSaveFood}
        initialData={selectedFood}
      />
    </ScrollView>
  );
};

export default FoodLogScreen;
