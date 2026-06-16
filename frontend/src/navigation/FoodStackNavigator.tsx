import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import FoodLogScreen from '../screens/main/FoodLogScreen';
import ManualFoodLogScreen from '../screens/main/ManualFoodLogScreen';

// VoiceMealLog is intentionally NOT registered here. It lives once, as a root-stack route
// (AppNavigator), exactly like its habit sibling VoiceHabit — the in-app mic entry point on
// FoodLogScreen reaches it via navigateToVoiceMealLog (the root navigationRef). Keeping a
// single registration removes the dual-route / dual-param-shape divergence between the two
// voice screens.
export type FoodStackParamList = {
  FoodLog: { selectedDate?: string } | undefined;
  ManualFoodLog: { selectedDate?: string } | undefined;
};

const Stack = createStackNavigator<FoodStackParamList>();

export const FoodStackNavigator = () => {
  return (
    <Stack.Navigator id="FoodStack" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FoodLog" component={FoodLogScreen} />
      <Stack.Screen name="ManualFoodLog" component={ManualFoodLogScreen} />
    </Stack.Navigator>
  );
};
