import React from 'react';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { useAuth } from '../context/AuthContext';
import IncomingMealCallScreen from '../screens/main/IncomingMealCallScreen';
import IncomingHabitCallScreen from '../screens/main/IncomingHabitCallScreen';
import MealScheduleScreen from '../screens/main/MealScheduleScreen';
import OnboardingMealScheduleScreen from '../screens/onboarding/OnboardingMealScheduleScreen';
import VoiceMealLogScreen from '../screens/main/VoiceMealLogScreen';
import VoiceHabitScreen from '../screens/main/VoiceHabitScreen';

export const navigationRef = createNavigationContainerRef();

export type RootStackParamList = {
  MainTabs: undefined;
  IncomingMealCall: { mealSlotId: string; autoAccept?: boolean };
  IncomingHabitCall: {
    habitId: string;
    habitName: string;
    habitTime: string;
    autoAccept?: boolean;
  };
  MealSchedule: undefined;
  OnboardingMealSchedule: undefined;
  VoiceMealLog: { mealSlotId?: string; autoStart?: boolean };
  VoiceHabit: {
    habitId: string;
    habitName: string;
    habitTime: string;
    autoStart?: boolean;
  };
};

const RootStack = createStackNavigator<RootStackParamList>();

const AuthenticatedNavigator = () => {
  return (
    <RootStack.Navigator id="RootStack" screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="MainTabs" component={MainTabNavigator} />
      <RootStack.Screen
        name="IncomingMealCall"
        component={IncomingMealCallScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: false,
          headerShown: false,
          cardStyle: { backgroundColor: 'transparent' },
          cardOverlayEnabled: false,
        }}
      />
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
      <RootStack.Screen
        name="VoiceMealLog"
        component={VoiceMealLogScreen}
        options={{ title: 'Voice Meal Log' }}
      />
      <RootStack.Screen
        name="IncomingHabitCall"
        component={IncomingHabitCallScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: false,
          headerShown: false,
          cardStyle: { backgroundColor: 'transparent' },
          cardOverlayEnabled: false,
        }}
      />
      <RootStack.Screen
        name="VoiceHabit"
        component={VoiceHabitScreen}
        options={{ title: 'Habit Check-in' }}
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
