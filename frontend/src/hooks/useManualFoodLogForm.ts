import { useCallback, useEffect, useRef, useState } from 'react';
import { MealType } from '../types/types';
import { foodLogApi } from '../services/api/foodLogApi';

export interface ManualFoodLogErrors {
  mealType: string;
  foodName: string;
  quantity: string;
  unit: string;
}

const EMPTY_ERRORS: ManualFoodLogErrors = {
  mealType: '',
  foodName: '',
  quantity: '',
  unit: '',
};

/**
 * Form controller for the manual food-entry screen: field state, validation, submit (via
 * foodLogApi), the transient success banner, and reset. ManualFoodLogScreen renders from it.
 */
export function useManualFoodLogForm(selectedDate: string) {
  const [mealType, setMealType] = useState<MealType | ''>('');
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [errors, setErrors] = useState<ManualFoodLogErrors>(EMPTY_ERRORS);
  const [submitError, setSubmitError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: ManualFoodLogErrors = { ...EMPTY_ERRORS };
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
  }, [mealType, foodName, quantity, unit]);

  const resetFields = useCallback(() => {
    setMealType('');
    setFoodName('');
    setQuantity('');
    setUnit('');
    setErrors(EMPTY_ERRORS);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setSubmitError('');
    setSubmitting(true);
    try {
      await foodLogApi.addEntries(selectedDate, mealType as string, [
        {
          name: foodName.trim(),
          quantity: parseFloat(quantity),
          unit: unit.trim(),
        },
      ]);

      setIsSuccess(true);
      resetFields();

      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
      successTimerRef.current = setTimeout(() => setIsSuccess(false), 3000);
    } catch (err) {
      setSubmitError('Failed to log food entry. Please try again.');
      console.error('Error adding food entry:', err);
    } finally {
      setSubmitting(false);
    }
  }, [validate, selectedDate, mealType, foodName, quantity, unit, resetFields]);

  const clearError = useCallback((field: keyof ManualFoodLogErrors) => {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev));
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    resetFields();
    setSubmitError('');
    setIsSuccess(false);
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    setRefreshing(false);
  }, [resetFields]);

  return {
    mealType,
    setMealType,
    foodName,
    setFoodName,
    quantity,
    setQuantity,
    unit,
    setUnit,
    errors,
    submitError,
    isSuccess,
    submitting,
    refreshing,
    validate,
    handleSubmit,
    clearError,
    handleRefresh,
  };
}
