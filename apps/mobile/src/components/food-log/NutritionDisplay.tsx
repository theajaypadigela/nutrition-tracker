import React from 'react';
import { VStack } from '../ui/vstack';
import { Text } from '../ui/text';
import { formatIndianNumber } from '@/src/utils/numberFormatter';
import { Divider } from '../ui/divider';
import MacroProgressBar from '../ui/MacroProgressBar';
import { AppleIcon, Droplets, Cookie, Drumstick } from 'lucide-react-native';

const NutritionDisplay = (props: {
  calories: number;
  targetCalories: number;
  totals: {
    protein: number;
    carbs: number;
    fat: number;
    sugar: number;
  };
  dailyGoals: {
    protein: number;
    carbs: number;
    fat: number;
    sugar: number;
  };
}) => {
  const { totals, dailyGoals } = props;

  return (
    <VStack className="w-full gap-6 p-6 bg-white rounded-2xl border border-gray-200 ">
      <VStack className="gap-6">
        <Text size="lg" className="font-bold text-gray-500">
          TODAY'S NUTRITION
        </Text>
        <VStack className="items-center gap-2">
          <Text size="5xl" className="font-bold">
            {formatIndianNumber(props.calories)}
          </Text>

          <Text>kcal</Text>
          <Text size="md" className="text-gray-500">
            Daily Target: {formatIndianNumber(props.targetCalories)} kcal
          </Text>
        </VStack>
      </VStack>
      <Divider className="h-[1px] mt-10" />
      <VStack className='gap-6'>
        <MacroProgressBar
          label="Protein"
          current={totals.protein}
          goal={dailyGoals.protein}
          unit="g"
          icon={<Drumstick size={16} />}
          is_healthy={true}
        />
        <MacroProgressBar
          label="Carbs"
          current={totals.carbs}
          goal={dailyGoals.carbs}
          unit="g"
          icon={<AppleIcon size={16} />}
          is_healthy={true}
        />
        <MacroProgressBar
          label="Fats"
          current={totals.fat}
          goal={dailyGoals.fat}
          unit="g"
          icon={<Droplets size={16} />}
          is_healthy={false}
        />
        <MacroProgressBar
          label="Sugar"
          current={totals.sugar}
          goal={dailyGoals.sugar}
          unit="g"
          icon={<Cookie size={16} />}
          is_healthy={false}
        />
      </VStack>
    </VStack>
  );
};

export default NutritionDisplay;
