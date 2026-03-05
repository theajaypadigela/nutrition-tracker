import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import FoodLogScreen from '../screens/main/FoodLogScreen';
import ManualFoodLogScreen from '../screens/main/ManualFoodLogScreen';

export type FoodStackParamList = {
  FoodLog: undefined;
  ManualFoodLog: undefined;
};

const Stack = createStackNavigator<FoodStackParamList>();

export const FoodStackNavigator = () => {
  return (
    <Stack.Navigator
      id="FoodStack"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="FoodLog" component={FoodLogScreen} />
      <Stack.Screen name="ManualFoodLog" component={ManualFoodLogScreen} />
    </Stack.Navigator>
  );
};
