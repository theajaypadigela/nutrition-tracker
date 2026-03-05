import React, { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, UtensilsCrossed, CheckCircle } from 'lucide-react-native';
import { Text } from '../../components/ui/text';
import { VStack } from '../../components/ui/vstack';
import { HStack } from '../../components/ui/hstack';
import { Input, InputField } from '../../components/ui/input';
import { Button, ButtonText } from '../../components/ui/button';
import { Divider } from '../../components/ui/divider';
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectInput,
  SelectIcon,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicatorWrapper,
  SelectDragIndicator,
} from '../../components/ui/select';
import { ChevronDownIcon } from 'lucide-react-native';
import useApi from '../../hooks/useApi';
import { MealType, MealsResponse } from '../../types/types';

const MEAL_TYPES: { label: string; value: MealType }[] = [
  { label: 'Breakfast', value: 'breakfast' },
  { label: 'Lunch', value: 'lunch' },
  { label: 'Snack', value: 'snack' },
  { label: 'Dinner', value: 'dinner' },
];

const COMMON_UNITS = [
  'g',
  'ml',
  'oz',
  'cup',
  'tbsp',
  'tsp',
  'piece',
  'bowl',
  'serving',
];

interface FormErrors {
  mealType: string;
  foodName: string;
  quantity: string;
  unit: string;
}

const ManualFoodLogScreen = () => {
  const navigation = useNavigation();
  const { request, loading } = useApi<MealsResponse>();

  const [mealType, setMealType] = useState<MealType | ''>('');
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [errors, setErrors] = useState<FormErrors>({
    mealType: '',
    foodName: '',
    quantity: '',
    unit: '',
  });
  const [submitError, setSubmitError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {
      mealType: '',
      foodName: '',
      quantity: '',
      unit: '',
    };
    let isValid = true;

    if (!mealType) {
      newErrors.mealType = 'Please select a meal type';
      isValid = false;
    }
    if (!foodName.trim()) {
      newErrors.foodName = 'Food name is required';
      isValid = false;
    } else if (foodName.trim().length < 2) {
      newErrors.foodName = 'Food name must be at least 2 characters';
      isValid = false;
    }
    if (!quantity.trim()) {
      newErrors.quantity = 'Quantity is required';
      isValid = false;
    } else if (isNaN(Number(quantity)) || Number(quantity) <= 0) {
      newErrors.quantity = 'Quantity must be a positive number';
      isValid = false;
    }
    if (!unit.trim()) {
      newErrors.unit = 'Unit is required';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitError('');

    try {
      const date = getTodayDate();
      await request({
        url: `/food/${date}/meals/${mealType}/entries`,
        method: 'POST',
        data: [
          {
            name: foodName.trim(),
            quantity: parseFloat(quantity),
            unit: unit.trim(),
          },
        ],
      });

      setIsSuccess(true);
      // Reset form
      setMealType('');
      setFoodName('');
      setQuantity('');
      setUnit('');
      setErrors({ mealType: '', foodName: '', quantity: '', unit: '' });

      setTimeout(() => setIsSuccess(false), 3000);
    } catch (err) {
      setSubmitError('Failed to log food entry. Please try again.');
      console.error('Error adding food entry:', err);
    }
  };

  const clearError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setMealType('');
    setFoodName('');
    setQuantity('');
    setUnit('');
    setSubmitError('');
    setIsSuccess(false);
    setErrors({ mealType: '', foodName: '', quantity: '', unit: '' });
    setRefreshing(false);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="bg-white px-6 pt-14 pb-4 border-b border-gray-200">
          <HStack className="items-center gap-3">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="w-9 h-9 items-center justify-center rounded-full bg-gray-100"
            >
              <ArrowLeft size={20} stroke="#374151" />
            </TouchableOpacity>
            <HStack className="items-center gap-2">
              <View className="w-8 h-8 bg-emerald-100 rounded-lg items-center justify-center">
                <UtensilsCrossed size={18} stroke="#10B981" />
              </View>
              <Text className="text-xl font-bold text-gray-900">Log Food</Text>
            </HStack>
          </HStack>
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <VStack className="p-6 gap-6">
            {/* Success banner */}
            {isSuccess && (
              <View className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <HStack className="items-center gap-2">
                  <CheckCircle size={18} stroke="#10B981" />
                  <Text className="text-sm font-semibold text-emerald-700">
                    Food entry added successfully!
                  </Text>
                </HStack>
              </View>
            )}

            {/* Error banner */}
            {!!submitError && (
              <View className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <Text className="text-sm text-red-600">{submitError}</Text>
              </View>
            )}

            {/* Form card */}
            <View className="bg-white rounded-2xl border border-gray-200 p-5">
              <Text className="text-base font-semibold text-gray-900 mb-4">
                Food Details
              </Text>
              <Divider className="mb-5" />

              <VStack className="gap-5">
                {/* Meal Type */}
                <VStack className="gap-1">
                  <Text className="text-sm font-medium text-gray-700">
                    Meal Type <Text className="text-red-500">*</Text>
                  </Text>
                  <Select
                    selectedValue={mealType}
                    onValueChange={val => {
                      setMealType(val as MealType);
                      clearError('mealType');
                    }}
                  >
                    <SelectTrigger
                      variant="outline"
                      size="lg"
                      className={`rounded-xl border-2 ${
                        errors.mealType ? 'border-red-400' : 'border-gray-200'
                      }`}
                    >
                      <SelectInput placeholder="Select meal type" />
                      <SelectIcon className="mr-3" as={ChevronDownIcon} />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdrop />
                      <SelectContent>
                        <SelectDragIndicatorWrapper>
                          <SelectDragIndicator />
                        </SelectDragIndicatorWrapper>
                        {MEAL_TYPES.map(meal => (
                          <SelectItem
                            key={meal.value}
                            label={meal.label}
                            value={meal.value}
                          />
                        ))}
                      </SelectContent>
                    </SelectPortal>
                  </Select>
                  {!!errors.mealType && (
                    <Text className="text-xs text-red-500 mt-0.5">
                      {errors.mealType}
                    </Text>
                  )}
                </VStack>

                {/* Food Name */}
                <VStack className="gap-1">
                  <Text className="text-sm font-medium text-gray-700">
                    Food Name <Text className="text-red-500">*</Text>
                  </Text>
                  <Input
                    variant="outline"
                    size="lg"
                    className={`rounded-xl border-2 ${
                      errors.foodName ? 'border-red-400' : 'border-gray-200'
                    }`}
                  >
                    <InputField
                      value={foodName}
                      onChangeText={text => {
                        setFoodName(text);
                        clearError('foodName');
                      }}
                      placeholder="e.g. Grilled Chicken Breast"
                      autoCapitalize="words"
                    />
                  </Input>
                  {!!errors.foodName && (
                    <Text className="text-xs text-red-500 mt-0.5">
                      {errors.foodName}
                    </Text>
                  )}
                </VStack>

                {/* Quantity & Unit row */}
                <HStack className="gap-3">
                  {/* Quantity */}
                  <VStack className="flex-1 gap-1">
                    <Text className="text-sm font-medium text-gray-700">
                      Quantity <Text className="text-red-500">*</Text>
                    </Text>
                    <Input
                      variant="outline"
                      size="lg"
                      className={`rounded-xl border-2 ${
                        errors.quantity ? 'border-red-400' : 'border-gray-200'
                      }`}
                    >
                      <InputField
                        value={quantity}
                        onChangeText={text => {
                          setQuantity(text);
                          clearError('quantity');
                        }}
                        placeholder="e.g. 100"
                        keyboardType="decimal-pad"
                      />
                    </Input>
                    {!!errors.quantity && (
                      <Text className="text-xs text-red-500 mt-0.5">
                        {errors.quantity}
                      </Text>
                    )}
                  </VStack>

                  {/* Unit */}
                  <VStack className="flex-1 gap-1">
                    <Text className="text-sm font-medium text-gray-700">
                      Unit <Text className="text-red-500">*</Text>
                    </Text>
                    <Select
                      selectedValue={unit}
                      onValueChange={val => {
                        setUnit(val);
                        clearError('unit');
                      }}
                    >
                      <SelectTrigger
                        variant="outline"
                        size="lg"
                        className={`rounded-xl border-2 ${
                          errors.unit ? 'border-red-400' : 'border-gray-200'
                        }`}
                      >
                        <SelectInput placeholder="Unit" />
                        <SelectIcon className="mr-3" as={ChevronDownIcon} />
                      </SelectTrigger>
                      <SelectPortal>
                        <SelectBackdrop />
                        <SelectContent>
                          <SelectDragIndicatorWrapper>
                            <SelectDragIndicator />
                          </SelectDragIndicatorWrapper>
                          {COMMON_UNITS.map(u => (
                            <SelectItem key={u} label={u} value={u} />
                          ))}
                        </SelectContent>
                      </SelectPortal>
                    </Select>
                    {!!errors.unit && (
                      <Text className="text-xs text-red-500 mt-0.5">
                        {errors.unit}
                      </Text>
                    )}
                  </VStack>
                </HStack>

                {/* Custom unit input if unit not in list */}
                <VStack className="gap-1">
                  <Text className="text-sm text-gray-500">
                    Or type a custom unit:
                  </Text>
                  <Input
                    variant="outline"
                    size="md"
                    className="rounded-xl border-2 border-gray-200"
                  >
                    <InputField
                      value={unit}
                      onChangeText={text => {
                        setUnit(text);
                        clearError('unit');
                      }}
                      placeholder="e.g. slice, portion, can…"
                      autoCapitalize="none"
                    />
                  </Input>
                </VStack>
              </VStack>
            </View>

            {/* Date info */}
            <View className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
              <HStack className="items-center gap-2">
                <Text className="text-xs text-blue-600">
                  📅 This entry will be logged for today:{' '}
                  <Text className="font-semibold">{getTodayDate()}</Text>
                </Text>
              </HStack>
            </View>

            {/* Submit button */}
            <Button
              variant="solid"
              size="xl"
              className="w-full bg-emerald-500 rounded-2xl"
              onPress={handleSubmit}
              isDisabled={loading}
            >
              <ButtonText className="text-white font-semibold text-base">
                {loading ? 'Adding Entry…' : 'Add Food Entry'}
              </ButtonText>
            </Button>
          </VStack>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

export default ManualFoodLogScreen;
