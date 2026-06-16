import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { useAuth } from '../context/AuthContext';
import MealScheduleScreen from '../screens/main/MealScheduleScreen';
import OnboardingMealScheduleScreen from '../screens/onboarding/OnboardingMealScheduleScreen';
import VoiceMealLogScreen from '../screens/main/VoiceMealLogScreen';
import VoiceHabitScreen from '../screens/main/VoiceHabitScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import ReminderHealthScreen from '../screens/main/ReminderHealthScreen';
import { navigationRef } from './navigationRef';
import type { VoiceHabitParams, VoiceMealLogParams } from './paramTypes';

export { navigationRef };

// The incoming call itself is a NATIVE screen (android/.../incomingcall/IncomingCallActivity),
// not a React route — so there are no IncomingMealCall/IncomingHabitCall routes. Accepting a call
// navigates straight into the voice session below.
export type RootStackParamList = {
  MainTabs: undefined;
  MealSchedule: undefined;
  OnboardingMealSchedule: undefined;
  Profile: undefined;
  ReminderHealth: undefined;
  VoiceMealLog: VoiceMealLogParams;
  VoiceHabit: VoiceHabitParams;
};

const RootStack = createStackNavigator<RootStackParamList>();

const AuthenticatedNavigator = () => {
  return (
    <RootStack.Navigator id="RootStack" screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="MainTabs" component={MainTabNavigator} />
      <RootStack.Screen
        name="MealSchedule"
        component={MealScheduleScreen}
        options={{
          headerShown: true,
          title: 'Meal Reminders',
          presentation: 'card',
        }}
      />
      <RootStack.Screen
        name="OnboardingMealSchedule"
        component={OnboardingMealScheduleScreen}
      />
      <RootStack.Screen name="Profile" component={ProfileScreen} />
      <RootStack.Screen
        name="ReminderHealth"
        component={ReminderHealthScreen}
        options={{
          headerShown: true,
          title: 'Reminder health',
          presentation: 'card',
        }}
      />
      <RootStack.Screen
        name="VoiceMealLog"
        component={VoiceMealLogScreen}
        options={{ title: 'Meal Voice Call' }}
      />
      {/*
        VoiceHabit has no in-app (non-call) entry point by design: a habit check-in is
        scoped to a specific scheduled time slot, so it is reached only by accepting a
        habit call. VoiceMealLog (general meal logging) keeps its FoodLog mic entry. The
        call EXPERIENCE itself is unified; the entry points differ deliberately.
      */}
      <RootStack.Screen
        name="VoiceHabit"
        component={VoiceHabitScreen}
        options={{ title: 'Habit Voice Call' }}
      />
    </RootStack.Navigator>
  );
};

export const AppNavigator = () => {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return null;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {isAuthenticated ? <AuthenticatedNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};
