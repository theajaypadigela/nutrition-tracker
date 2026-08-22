import React, { useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { Activity, EyeIcon, EyeOffIcon } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Input,
  InputField,
  InputSlot,
  InputIcon,
} from '../../components/ui/input';
import { FormControl } from '../../components/ui/form-control';
import { VStack } from '../../components/ui/vstack';
import { Text } from '../../components/ui/text';
import { Button, ButtonText } from '../../components/ui/button';
import { HStack } from '../../components/ui/hstack';
import { Divider } from '../../components/ui/divider';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useAuth } from '@/src/context/AuthContext';

type LoginScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Login'
>;

export function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { login, isLoading } = useAuth();

  const validateEmail = (emailValue: string): boolean => {
    if (!emailValue) {
      setEmailError('Email is required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue)) {
      setEmailError('Invalid email format');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = (passwordValue: string): boolean => {
    if (!passwordValue) {
      setPasswordError('Password is required');
      return false;
    }
    if (passwordValue.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleEmailBlur = () => {
    validateEmail(email);
  };

  const handlePasswordBlur = () => {
    validatePassword(password);
  };

  const isFormValid = (): boolean => {
    return validateEmail(email) && validatePassword(password);
  };

  const handleState = () => {
    setShowPassword(prevState => !prevState);
  };

  const loadRegisterScreen = () => {
    navigation.navigate('Register');
  };

  const loginUser = async () => {
    if (!isFormValid()) return;

    setLoginError('');

    // Developer bypass — handled entirely at the frontend level
    if (__DEV__ && email === 'dev@gmail.com' && password === '123456') {
      navigation.navigate('DeveloperSettings');
      return;
    }

    try {
      await login(email, password);
      console.log('Login successful');
    } catch (error) {
      console.error('Login error:', error);
      setLoginError(
        error instanceof Error
          ? error.message
          : 'Login failed. Please try again.',
      );
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setEmail('');
    setPassword('');
    setEmailError('');
    setPasswordError('');
    setLoginError('');
    setRefreshing(false);
  };

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View className="flex-1 gap-6 items-center justify-center p-6">
        <View className="items-center gap-6 space-y-4">
          <View className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center">
            <Activity size={32} stroke="white" strokeWidth={2.5} />
          </View>
          <View className="items-center gap-3 space-y-2">
            <Text className="text-2xl font-semibold text-gray-900">
              Habit Builder
            </Text>
            <Text className="text-lg text-gray-600">Welcome Back</Text>
          </View>
        </View>
        <FormControl className="p-4 rounded-lg w-full">
          <VStack className="gap-6">
            <VStack space="xs">
              <Text className="text-typography-400">Email</Text>
              <Input
                size="xl"
                className={`
                w-full px-4 h-14 rounded-xl border-2
                text-gray-900 placeholder:text-gray-400
                bg-white
                ${emailError ? 'border-red-500' : 'border-gray-200'}
              `}
              >
                <InputField
                  type="text"
                  value={email}
                  onChangeText={setEmail}
                  onBlur={handleEmailBlur}
                  placeholder="Enter your email"
                />
              </Input>
              {emailError && (
                <Text className="text-red-500 text-md ml-2">{emailError}</Text>
              )}
            </VStack>
            <VStack space="xs">
              <Text className="text-typography-400">Password</Text>
              <Input
                size="xl"
                className={`
                w-full px-4 h-14 rounded-xl border-2
                text-gray-900 placeholder:text-gray-400
                bg-white
                ${passwordError ? 'border-red-500' : 'border-gray-200'}
              `}
              >
                <InputField
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChangeText={setPassword}
                  onBlur={handlePasswordBlur}
                  placeholder="Enter your password"
                />
                <InputSlot className="pr-8" onPress={handleState}>
                  <InputIcon as={showPassword ? EyeIcon : EyeOffIcon} />
                </InputSlot>
              </Input>
              {passwordError && (
                <Text className="text-red-500 text-md ml-2">
                  {passwordError}
                </Text>
              )}
            </VStack>
            <Button className="ml-auto" variant="link" size="sm">
              <ButtonText className="text-emerald-600">
                Forgot Password?
              </ButtonText>
            </Button>

            {loginError && (
              <VStack className="w-full bg-red-50 border border-red-200 rounded-xl p-4">
                <Text className="text-red-600 text-center">{loginError}</Text>
              </VStack>
            )}

            <Button
              variant="solid"
              size="xl"
              className="w-full bg-emerald-500 rounded-xl"
              isDisabled={
                !email ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
                !password ||
                password.length < 6 ||
                isLoading
              }
              onPress={loginUser}
            >
              <ButtonText className="text-white font-medium">
                {isLoading ? 'Logging in...' : 'Login'}
              </ButtonText>
            </Button>
            <HStack className="items-center my-4">
              <Divider className="flex-1 h-[1px]" />
              <Text className="mx-3 text-sm text-muted-500">OR</Text>
              <Divider className="flex-1 h-[1px]" />
            </HStack>
          </VStack>
        </FormControl>
        <Button
          onPress={loadRegisterScreen}
          variant="outline"
          size="xl"
          className="w-full rounded-xl border-gray-200"
        >
          <ButtonText className="font-medium">Create Account</ButtonText>
        </Button>
      </View>
    </ScrollView>
  );
}
