import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { useAuth } from '../context/AuthContext';
import IncomingCallScreen from '../components/IncomingCallScreen';
import MealScheduleScreen from '../screens/main/MealScheduleScreen';
import OnboardingMealScheduleScreen from '../screens/onboarding/OnboardingMealScheduleScreen';
import VoiceMealLogScreen from '../screens/main/VoiceMealLogScreen';
import VoiceHabitScreen from '../screens/main/VoiceHabitScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import ReminderHealthScreen from '../screens/main/ReminderHealthScreen';
import { navigationRef } from './navigationRef';
import type {
  IncomingHabitCallParams,
  IncomingMealCallParams,
  VoiceHabitParams,
  VoiceMealLogParams,
} from './paramTypes';

export { navigationRef };

export type RootStackParamList = {
  MainTabs: undefined;
  IncomingMealCall: IncomingMealCallParams;
  IncomingHabitCall: IncomingHabitCallParams;
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
        name="IncomingMealCall"
        component={IncomingCallScreen}
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
        options={{ title: 'Voice Meal Log' }}
      />
      <RootStack.Screen
        name="IncomingHabitCall"
        component={IncomingCallScreen}
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
