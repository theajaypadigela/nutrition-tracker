import { ScrollView, View } from 'react-native';
import { VStack } from '../../components/ui/vstack';
import { HStack } from '../../components/ui/hstack';
import React from 'react';
import CaloriesSummaryCard from '../../components/nutrition-report/CaloriesSummaryCard';
import MacroNutrientsSection from '../../components/nutrition-report/MacroNutrientsSection';
import MicroNutrientsSection from '../../components/nutrition-report/MicroNutrientsSection';
import { Lightbulb } from 'lucide-react-native';
import { Text } from '../../components/ui/text';
import InsightsBadge from '../../components/nutrition-report/InsightsBadge';
import AllNutritionsCard from '../../components/nutrition-report/AllNutritionsCard';


interface Insight {
    variant: 'positive' | 'negative' | 'neutral';
    message: string;
}

const NutritionReportScreen = () => {
  // Sample data - replace with your actual data
  const weeklyAvgCalories = 2150;
  const dailyCalorieGoal = 2500;

  const macroNutrients = {
    protein: { current: 145, goal: 180 },
    carbs: { current: 220, goal: 250 },
    fats: { current: 58, goal: 70 },
  };

  const microNutrients = {
    sugar: { current: 28, goal: 40 },
    fiber: { current: 22, goal: 30 },
    sodium: { current: 1800, goal: 2300 },
  };

  const insights: Insight[] = [
    {
      variant: 'positive',
      message: 'Fiber Low this week- add Oats, Veggies and Fruits to your diet',
    },
    {
      variant: 'negative',
      message: 'Sugar High this week- reduce sugary drinks and desserts',
    },
    {
      variant: 'neutral',
      message: 'Sodium Low this week- add more salt to your diet',
    },
  ];

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <VStack className="p-6 gap-6">
        {/* Weekly Calories Summary */}
        <CaloriesSummaryCard
          weeklyAvgCalories={weeklyAvgCalories}
          dailyCalorieGoal={dailyCalorieGoal}
        />

        {/* Macro Nutrients Section */}
        <MacroNutrientsSection macroNutrients={macroNutrients} />
      </VStack>

      {/* Micro Nutrients Section - FlatList outside VStack for horizontal scroll */}
      <MicroNutrientsSection microNutrients={microNutrients} />

      <VStack className='p-6 bg-white border rounded-2xl border-gray-200 m-6 gap-4'>
        <HStack>
          <Lightbulb size={20} color={'#d97706'} />
          <Text size='md' className='font-bold'>AI Insights</Text>
        </HStack>

        {insights.map((insight, index) => (
          <InsightsBadge key={index} variant={insight.variant} message={insight.message} />
        ))}
      </VStack>
      <AllNutritionsCard />
      <VStack className='h-20'/>
    </ScrollView>
  );
};

export default NutritionReportScreen;
