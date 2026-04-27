import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import FoodLogScreen from '../screens/main/FoodLogScreen';
import ManualFoodLogScreen from '../screens/main/ManualFoodLogScreen';
import VoiceMealLogScreen from '../screens/main/VoiceMealLogScreen';

export type FoodStackParamList = {
  FoodLog: { selectedDate?: string } | undefined;
  ManualFoodLog: { selectedDate?: string } | undefined;
  VoiceMealLog:
    | {
        selectedDate?: string;
        mealSlotId?: string;
        autoStart?: boolean;
      }
    | undefined;
};

const Stack = createStackNavigator<FoodStackParamList>();

export const FoodStackNavigator = () => {
  return (
    <Stack.Navigator id="FoodStack" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FoodLog" component={FoodLogScreen} />
      <Stack.Screen name="ManualFoodLog" component={ManualFoodLogScreen} />
      <Stack.Screen
        name="VoiceMealLog"
        component={VoiceMealLogScreen}
        options={{ title: 'Voice Meal Log' }}
      />
    </Stack.Navigator>
  );
};
