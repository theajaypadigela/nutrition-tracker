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
  Home: undefined;
  Habits: undefined;
  Food: undefined;
  Reports: undefined;
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
        return <BottomNavigation activeTab={props.state.routeNames[props.state.index]} onTabChange={(tab) => { props.navigation.navigate(tab); }} />
      }}
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
        name="Food" 
        component={FoodLogScreen}
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
