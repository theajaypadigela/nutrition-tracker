import React, { useState, useMemo } from 'react';
import { Text } from '../../components/ui/text';
import {
  Input,
  InputField,
  InputSlot,
  InputIcon,
} from '../../components/ui/input';
import { VStack } from '../../components/ui/vstack';
import { ScrollView, RefreshControl } from 'react-native';
import {
  Select,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
} from '../../components/ui/select';
import { ChevronDownIcon } from '../../components/ui/icon';
import { Activity, EyeIcon, EyeOffIcon } from 'lucide-react-native';
import { ButtonText, Button } from '../../components/ui/button';
import { useAuth } from '@/src/context/AuthContext';

const RegisterScreen = () => {
  const [selectedGender, setSelectedGender] = useState('');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [fullNameError, setFullNameError] = useState('');
  const [ageError, setAgeError] = useState('');
  const [genderError, setGenderError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { register, isLoading } = useAuth();

  const handleTogglePassword = () => {
    setShowPassword(prevState => !prevState);
  };

  const handleToggleConfirmPassword = () => {
    setShowConfirmPassword(prevState => !prevState);
  };

  const handleConfirmPasswordBlur = () => {
    if (confirmPassword && password && confirmPassword !== password) {
      setConfirmPasswordError('Passwords do not match');
    } else {
      setConfirmPasswordError('');
    }
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

  const handleEmailBlur = () => {
    validateEmail(email);
  };

  const validateFullName = (name: string): boolean => {
    if (!name.trim()) {
      setFullNameError('Full name is required');
      return false;
    }
    setFullNameError('');
    return true;
  };

  const handleFullNameBlur = () => {
    validateFullName(fullName);
  };

  const validateAge = (age: string): boolean => {
    if (!age) {
      setAgeError('Age is required');
      return false;
    }
    if (isNaN(Number(age)) || Number(age) <= 0) {
      setAgeError('Invalid age');
      return false;
    }
    setAgeError('');
    return true;
  };

  const handleAgeBlur = () => {
    validateAge(age);
  };

  const validateGender = (gender: string): boolean => {
    if (!gender) {
      setGenderError('Gender is required');
      return false;
    }
    setGenderError('');
    return true;
  };

  const validatePassword = (pwd: string): boolean => {
    if (!pwd) {
      setPasswordError('Password is required');
      return false;
    }
    if (pwd.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handlePasswordBlur = () => {
    validatePassword(password);
  };

  const isFormValid = useMemo(() => {
    return (
      fullName.trim() !== '' &&
      age !== '' &&
      selectedGender !== '' &&
      email !== '' &&
      password !== '' &&
      confirmPassword !== '' &&
      password === confirmPassword &&
      !fullNameError &&
      !ageError &&
      !genderError &&
      !emailError &&
      !passwordError &&
      !confirmPasswordError
    );
  }, [
    fullName,
    age,
    selectedGender,
    email,
    password,
    confirmPassword,
    fullNameError,
    ageError,
    genderError,
    emailError,
    passwordError,
    confirmPasswordError,
  ]);

  const handleRegister = async () => {
    if (!isFormValid) {
      return;
    }

    setRegisterError('');

    try {
      await register(fullName, email, password, age, selectedGender);
      console.log('Registration successful');
      // Navigation will be handled by AuthContext
    } catch (error) {
      console.error('Registration error:', error);
      setRegisterError(
        error instanceof Error
          ? error.message
          : 'Registration failed. Please try again.',
      );
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setSelectedGender('');
    setAge('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setPasswordError('');
    setConfirmPasswordError('');
    setEmailError('');
    setFullNameError('');
    setAgeError('');
    setGenderError('');
    setRegisterError('');
    setRefreshing(false);
  };

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <VStack className="flex-1 gap-6 items-center justify-center p-6">
        <VStack className="items-center gap-6 space-y-4">
          <VStack className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center">
            <Activity size={32} stroke="white" strokeWidth={2.5} />
          </VStack>
          <VStack className="items-center gap-3 space-y-2">
            <Text className="text-2xl font-semibold text-gray-900">
              Create Account
            </Text>
            <Text className="text-lg text-gray-600">
              Start Tracking Your Nutrition
            </Text>
          </VStack>
        </VStack>
        <VStack className="gap-2">
          <Text>Full Name *</Text>
          <Input
            size="xl"
            className={`
                w-full px-4 h-14 rounded-xl border-2
                text-gray-900 placeholder:text-gray-400
                bg-white
                ${fullNameError ? 'border-red-500' : 'border-gray-200'}
              `}
          >
            <InputField
              type="text"
              value={fullName}
              onChangeText={setFullName}
              onBlur={handleFullNameBlur}
              placeholder="Enter your name.."
            />
          </Input>
          {fullNameError && (
            <Text className="text-red-500 text-md ml-2">{fullNameError}</Text>
          )}
        </VStack>
        <VStack className="gap-2">
          <Text>Age *</Text>
          <Input
            size="xl"
            className={`
                w-full px-4 h-14 rounded-xl border-2
                text-gray-900 placeholder:text-gray-400
                bg-white
                ${ageError ? 'border-red-500' : 'border-gray-200'}
              `}
          >
            <InputField
              value={age}
              placeholder="Enter your age"
              keyboardType="number-pad"
              onChangeText={text => setAge(text.replace(/[^0-9]/g, ''))}
              onBlur={handleAgeBlur}
            />
          </Input>
          {ageError && (
            <Text className="text-red-500 text-md ml-2">{ageError}</Text>
          )}
        </VStack>
        <VStack className="gap-2">
          <Text>Gender *</Text>
          <Select
            selectedValue={selectedGender}
            onValueChange={value => {
              setSelectedGender(value);
              validateGender(value);
            }}
            className="w-full"
          >
            <SelectTrigger
              className={`w-full px-4 h-14 rounded-xl border-2 bg-white ${genderError ? 'border-red-500' : 'border-gray-200'}`}
            >
              <SelectInput
                placeholder="Select gender"
                className="px-0 text-gray-900 placeholder:text-gray-400 flex-1"
              />
              <SelectIcon as={ChevronDownIcon} className="text-gray-500" />
            </SelectTrigger>
            <SelectPortal>
              <SelectBackdrop />
              <SelectContent>
                <SelectDragIndicatorWrapper>
                  <SelectDragIndicator />
                </SelectDragIndicatorWrapper>
                <SelectItem label="Male" value="male" />
                <SelectItem label="Female" value="female" />
                <SelectItem label="Other" value="other" />
                <SelectItem
                  label="Prefer not to say"
                  value="prefer_not_to_say"
                />
              </SelectContent>
            </SelectPortal>
          </Select>
          {genderError && (
            <Text className="text-red-500 text-md ml-2">{genderError}</Text>
          )}
        </VStack>
        <VStack className="gap-2">
          <Text>Email *</Text>
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
              placeholder="Enter your email.."
            />
          </Input>
          {emailError && (
            <Text className="text-red-500 text-md ml-2">{emailError}</Text>
          )}
        </VStack>
        <VStack className="gap-2">
          <Text>Password *</Text>
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
            />
            <InputSlot className="pr-8" onPress={handleTogglePassword}>
              <InputIcon as={showPassword ? EyeIcon : EyeOffIcon} />
            </InputSlot>
          </Input>
          {passwordError && (
            <Text className="text-red-500 text-md ml-2">{passwordError}</Text>
          )}
        </VStack>

        <VStack className="gap-2">
          <Text>Confirm Password *</Text>
          <Input
            size="xl"
            className={`
                w-full px-4 h-14 rounded-xl border-2
                text-gray-900 placeholder:text-gray-400
                bg-white
                ${confirmPasswordError ? 'border-red-500' : ''}
              `}
          >
            <InputField
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onBlur={handleConfirmPasswordBlur}
              placeholder="Confirm your password"
            />
            <InputSlot className="pr-8" onPress={handleToggleConfirmPassword}>
              <InputIcon as={showConfirmPassword ? EyeIcon : EyeOffIcon} />
            </InputSlot>
          </Input>
          {confirmPasswordError && (
            <Text className="text-red-500 text-md ml-2">
              {confirmPasswordError}
            </Text>
          )}
        </VStack>

        {registerError && (
          <VStack className="w-full bg-red-50 border border-red-200 rounded-xl p-4">
            <Text className="text-red-600 text-center">{registerError}</Text>
          </VStack>
        )}

        <Button
          variant="solid"
          size="xl"
          className="w-full bg-emerald-500 rounded-xl"
          isDisabled={!isFormValid || isLoading}
          onPress={handleRegister}
        >
          <ButtonText className="text-white font-medium">
            {isLoading ? 'Registering...' : 'Register'}
          </ButtonText>
        </Button>

        <Button variant="link" size="md" className="mt-3">
          <ButtonText className="text-gray-600">
            Already have an account?{' '}
            <Text className="text-emerald-600 hover:text-emerald-700 font-medium">
              Login
            </Text>
          </ButtonText>
        </Button>
      </VStack>
    </ScrollView>
  );
};

export default RegisterScreen;
