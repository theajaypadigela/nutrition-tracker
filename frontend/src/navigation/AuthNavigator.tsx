import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { LoginScreen } from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

const DeveloperSettingsScreen = __DEV__
  ? require('../screens/dev/DeveloperSettingsScreen').default
  : null;

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  DeveloperSettings: undefined;
};

const Stack = createStackNavigator<AuthStackParamList>();

export const AuthNavigator = () => {
  return (
    <Stack.Navigator
      id="AuthStack"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      {__DEV__ && DeveloperSettingsScreen ? (
        <Stack.Screen
          name="DeveloperSettings"
          component={DeveloperSettingsScreen}
        />
      ) : null}
    </Stack.Navigator>
  );
};
