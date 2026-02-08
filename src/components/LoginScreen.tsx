import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Activity } from 'lucide-react-native';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [globalError, setGlobalError] = useState('');
  const [networkError, setNetworkError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email: string): boolean => {
    if (!email) {
      setEmailError('Email is required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('Invalid email format');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = (password: string): boolean => {
    if (!password) {
      setPasswordError('Password is required');
      return false;
    }
    setPasswordError('');
    return true;
  };

  return (
    <View className="flex-1 items-center justify-center p-6">
      <View className="items-center space-y-4">
        <View className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center">
          <Activity size={32} stroke="white" strokeWidth={2.5} />
        </View>
        <View className="items-center space-y-2">
          <Text className="text-2xl font-semibold text-gray-900">
            Habit Builder
          </Text>
          <Text className="text-lg text-gray-600">Welcome Back</Text>
        </View>
      </View>
    </View>
  );
}
