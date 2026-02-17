import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { User } from 'lucide-react-native';
import DashBoardScreen from '../screens/main/DashBoardScreen';
import HabitScreen from '../screens/main/HabitScreen';
import FoodLogScreen from '../screens/main/FoodLogScreen';
import NutritionReportScreen from '../screens/main/NutritionReportScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import { View } from 'react-native';
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
  return (
    <Tab.Navigator
      id="MainTab"
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#FFFFFF',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
        },
        headerTitleStyle: {
          fontSize: 20,
          fontWeight: '700',
          color: '#111827',
          letterSpacing: 0.2,
        },
        headerTitleAlign: 'left',
        headerRight: () => (
          <TouchableOpacity
            style={headerStyles.profileButton}
            activeOpacity={0.7}
          >
            <View style={headerStyles.profileIcon}>
              <User size={18} stroke="#059669" strokeWidth={2.2} />
            </View>
          </TouchableOpacity>
        ),
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
      tabBar={props => {
        return (
          <BottomNavigation
            activeTab={props.state.routeNames[props.state.index]}
            onTabChange={tab => {
              props.navigation.navigate(tab);
            }}
          />
        );
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

const headerStyles = StyleSheet.create({
  profileButton: {
    marginRight: 16,
  },
  profileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
