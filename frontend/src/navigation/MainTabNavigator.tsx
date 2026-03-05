import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashBoardScreen from '../screens/main/DashBoardScreen';
import HabitScreen from '../screens/main/HabitScreen';
import HabitCreationScreen from '../screens/main/HabitCreationScreen';
import NutritionReportScreen from '../screens/main/NutritionReportScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import BottomNavigation from '../components/BottomNavigation';
import { FoodStackNavigator } from './FoodStackNavigator';

export type MainTabParamList = {
  Home: undefined;
  Habits: undefined;
  HabitCreation: undefined;
  Food: undefined;
  Reports: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const CustomTabBar = (props: any) => {
  const currentRouteName = props.state.routeNames[props.state.index];

  if (currentRouteName === 'HabitCreation') {
    return null;
  }

  return (
    <BottomNavigation
      activeTab={currentRouteName}
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
        component={NutritionReportScreen}
        options={{ title: 'Nutrition Report' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};
