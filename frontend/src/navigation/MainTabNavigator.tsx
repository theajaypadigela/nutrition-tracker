import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashBoardScreen from '../screens/main/DashBoardScreen';
import HabitScreen from '../screens/main/HabitScreen';
import FoodLogScreen from '../screens/main/FoodLogScreen';
import NutritionReportScreen from '../screens/main/NutritionReportScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import { useAuth } from '../context/AuthContext';
import BottomNavigation from '../components/BottomNavigation';

export type MainTabParamList = {
  Dashboard: undefined;
  Habits: undefined;
  FoodLog: undefined;
  Nutrition: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator = () => {
  const { user } = useAuth();

  return (
    <Tab.Navigator
      id="MainTab"
      screenOptions={{
        headerShown: true,
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
      tabBar={(props) => {
        // We'll use our custom BottomNavigation component
        // For now, return null and handle it in the screens

        return <BottomNavigation activeTab='home' onTabChange={(id) => {  }} /> //selected tab and onTabChange handler
      }}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashBoardScreen}
        options={{ title: 'Dashboard' }}
      />
      <Tab.Screen 
        name="Habits" 
        component={HabitScreen}
        options={{ title: 'Habits' }}
      />
      <Tab.Screen 
        name="FoodLog" 
        component={FoodLogScreen}
        options={{ title: 'Food Log' }}
      />
      <Tab.Screen 
        name="Nutrition" 
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
