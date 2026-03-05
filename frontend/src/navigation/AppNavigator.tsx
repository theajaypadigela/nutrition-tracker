import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { useAuth } from '../context/AuthContext';

export const AppNavigator = () => {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return null;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainTabNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};
