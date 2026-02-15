import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { useAuth } from '../context/AuthContext';

export const AppNavigator = () => {
  const { isAuthenticated } = useAuth();

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainTabNavigator /> : <AuthNavigator />}
      {/* {isAuthenticated ? <MainTabNavigator /> : <MainTabNavigator />} */}
    </NavigationContainer>
  );
};
