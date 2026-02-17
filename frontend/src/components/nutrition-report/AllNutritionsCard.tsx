import React, { useState } from 'react';
import { View } from 'react-native';
import { VStack } from '../ui/vstack';
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
import { ChevronDownIcon } from 'lucide-react-native';
import NutritionCard from './NutritionCard';
import NutritionDetailDrawer from './NutritionDetailDrawer';
import { Nutrition, NutrientDetailData } from './types';

const NutritionData: Nutrition[] = [
  {
    id: 1,
    name: 'Sodium',
    unit: 'mg',
    value: 1200,
    goal: 2300,
    type: 'minerals',
  },
  {
    id: 2,
    name: 'Protein',
    unit: 'g',
    value: 120,
    goal: 150,
    type: 'macro',
  },
  {
    id: 3,
    name: 'Vitamin D',
    unit: 'IU',
    value: 400,
    goal: 600,
    type: 'vitamins',
  },
  {
    id: 4,
    name: 'Iron',
    unit: 'mg',
    value: 8,
    goal: 18,
    type: 'minerals',
  },
];

const AllNutritionsCard = () => {
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedNutrient, setSelectedNutrient] =
    useState<NutrientDetailData | null>(null);

  const handleOpenDrawer = (item: Nutrition) => {
    console.log('Opening drawer for:', item.name);
    // Map simple Nutrition item to detailed NutrientData
    const detailedNutrient: NutrientDetailData = {
      id: item.id.toString(),
      name: item.name,
      amount: item.value,
      unit: item.unit,
      target: item.goal,
      pctDV: Math.round((item.value / item.goal) * 100),
      weeklyAvg: Math.round((item.value / item.goal) * 90), // Mock data
      flag:
        item.value < item.goal
          ? 'low'
          : item.value > item.goal * 1.2
            ? 'high'
            : 'ok',
      hasAvoidPreference: false,
      trend: [
        item.value * 0.8,
        item.value * 0.9,
        item.value,
        item.value * 1.1,
        item.value * 0.9,
        item.value,
        item.value,
      ], // Mock trend
      topSources: ['Source A', 'Source B'],
      pinned: false,
    };
    setSelectedNutrient(detailedNutrient);
    setShowDrawer(true);
  };

  return (
    <VStack className="bg-white rounded-2xl border border-gray-200 m-6 gap-6">
      <VStack className="gap-6 p-4 bg-gray-100">
        <SearchBar />
        <View className="flex-row flex-wrap">
          <Select className="w-1/2 p-2">
            <SelectTrigger className="bg-white" variant="outline" size="md">
              <SelectInput placeholder="Select option" />
              <SelectIcon className="mr-3" as={ChevronDownIcon} />
            </SelectTrigger>
            <SelectPortal>
              <SelectBackdrop />
              <SelectContent>
                <SelectDragIndicatorWrapper>
                  <SelectDragIndicator />
                </SelectDragIndicatorWrapper>
                <SelectItem label="All Categories" value="all" />
                <SelectItem label="Macro" value="macro" />
                <SelectItem label="Minerals" value="minerals" />
                <SelectItem label="Vitamins" value="vitamins" />
                <SelectItem label="Others" value="others" />
              </SelectContent>
            </SelectPortal>
          </Select>
          <Select className="w-1/2 p-2">
            <SelectTrigger className="bg-white" variant="outline" size="md">
              <SelectInput placeholder="Select option" />
              <SelectIcon className="mr-3" as={ChevronDownIcon} />
            </SelectTrigger>
            <SelectPortal>
              <SelectBackdrop />
              <SelectContent>
                <SelectDragIndicatorWrapper>
                  <SelectDragIndicator />
                </SelectDragIndicatorWrapper>
                <SelectItem label="All Status" value="all" />
                <SelectItem label="Low" value="low" />
                <SelectItem label="High" value="high" />
                <SelectItem label="OK" value="ok" />
              </SelectContent>
            </SelectPortal>
          </Select>
        </View>
      </VStack>
      <VStack>
        {NutritionData.map(item => (
          <NutritionCard
            key={item.id}
            id={item.id}
            name={item.name}
            unit={item.unit}
            value={item.value}
            goal={item.goal}
            type={item.type}
            onPress={() => handleOpenDrawer(item)}
          />
        ))}
      </VStack>
      <NutritionDetailDrawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        selectedNutrient={selectedNutrient}
        onPin={id => console.log('Pin', id)}
        onSetTarget={() => console.log('Set Target')}
        _onAddFood={() => console.log('Add Food')}
        onMarkAvoid={() => console.log('Mark Avoid')}
      />
    </VStack>
  );
};

export default AllNutritionsCard;
