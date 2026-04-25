import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashBoardScreen from '../screens/main/DashBoardScreen';
import HabitScreen from '../screens/main/HabitScreen';
import HabitCreationScreen from '../screens/main/HabitCreationScreen';
import BottomNavigation from '../components/BottomNavigation';
import { FoodStackNavigator } from './FoodStackNavigator';
import { ReportsStackNavigator } from './ReportsStackNavigator';

export type MainTabParamList = {
  Home: undefined;
  Habits: undefined;
  HabitCreation: undefined;
  Food: undefined;
  Reports: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_BAR_HIDDEN_ROUTES = new Set(['HabitCreation', 'VoiceMealLog', 'VoiceHabit']);

const getDeepestRouteName = (route: any): string => {
  let current = route;
  while (current?.state?.index != null && current.state.routes) {
    current = current.state.routes[current.state.index];
  }
  return current?.name ?? route?.name ?? '';
};

const CustomTabBar = (props: any) => {
  const currentRoute = props.state.routes[props.state.index];
  const currentRouteName = getDeepestRouteName(currentRoute);
  const activeTabName = currentRoute?.name ?? '';

  if (TAB_BAR_HIDDEN_ROUTES.has(currentRouteName)) {
    return null;
  }

  return (
    <BottomNavigation
      activeTab={activeTabName}
      onTabChange={tab => {
        props.navigation.navigate(tab);
      }}
    />
  );
};

export const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      id="MainTab"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
      tabBar={CustomTabBar}
    >
      <Tab.Screen
        name="Home"
        component={DashBoardScreen}
        options={{ title: 'Dashboard' }}
      />
      <Tab.Screen
        name="Habits"
        component={HabitScreen}
        options={{ title: 'Habits' }}
      />
      <Tab.Screen
        name="HabitCreation"
        component={HabitCreationScreen}
        options={{ title: 'Create Habit' }}
      />
      <Tab.Screen
        name="Food"
        component={FoodStackNavigator}
        options={{ title: 'Food Log' }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsStackNavigator}
        options={{ title: 'Nutrition Report' }}
      />
    </Tab.Navigator>
  );
};
