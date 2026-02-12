import React, { useState } from 'react';
import { View } from 'react-native';
import { Activity, EyeIcon, EyeOffIcon } from 'lucide-react-native';
import { Input, InputField, InputSlot, InputIcon } from '../../components/ui/input';
import { FormControl } from '../../components/ui/form-control';
import { VStack } from '../../components/ui/vstack';
import { Heading } from '../../components/ui/heading';
import { Text } from '../../components/ui/text';
import { Button, ButtonText } from '../../components/ui/button';
import { HStack } from '../../components/ui/hstack';
import { Divider } from '../../components/ui/divider';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [globalError, setGlobalError] = useState('');
  const [networkError, setNetworkError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleState = () => {
    setShowPassword(prevState => !prevState);
  };

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
              <InputField type="text" />
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
              <InputField type={showPassword ? 'text' : 'password'} />
              <InputSlot className="pr-8" onPress={handleState}>
                <InputIcon as={showPassword ? EyeIcon : EyeOffIcon} />
              </InputSlot>
            </Input>
            {passwordError && (
              <Text className="text-red-500 text-md ml-2">{passwordError}</Text>
            )}
          </VStack>
          <Button className="ml-auto" variant="link" size="sm">
            <ButtonText className="text-emerald-600">
              Forgot Password?
            </ButtonText>
          </Button>

          <Button
            variant="solid"
            size="xl"
            className="w-full bg-emerald-500 rounded-xl"
          >
                 <ButtonText className="text-white font-medium">Login</ButtonText>
          </Button>
          <HStack className="items-center my-4">
            <Divider className="flex-1 h-[1px]" />
            <Text className="mx-3 text-sm text-muted-500">OR</Text>
            <Divider className="flex-1 h-[1px]" />
          </HStack>
        </VStack>
      </FormControl>
      <Button
        variant="outline"
        size="xl"
        className="w-full rounded-xl border-gray-200"
      >
        <ButtonText className="font-medium">Create Account</ButtonText>
      </Button>
    </View>
  );
}
