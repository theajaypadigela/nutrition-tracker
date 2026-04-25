import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import NutritionReportScreen from '../screens/main/NutritionReportScreen';
import WeeklyNutritionSummaryScreen from '../screens/main/WeeklyNutritionSummaryScreen';

export type ReportsStackParamList = {
  NutritionReport: undefined;
  WeeklyNutritionSummary: undefined;
};

const Stack = createStackNavigator<ReportsStackParamList>();

export const ReportsStackNavigator = () => {
  return (
    <Stack.Navigator id="ReportsStack" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="NutritionReport" component={NutritionReportScreen} />
      <Stack.Screen
        name="WeeklyNutritionSummary"
        component={WeeklyNutritionSummaryScreen}
      />
    </Stack.Navigator>
  );
};
