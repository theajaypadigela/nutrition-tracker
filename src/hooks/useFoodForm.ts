import { useState } from 'react';

interface FoodItem {
  id: string;
  name: string;
  quantity: string;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface FormErrors {
  foodName: string;
  quantity: string;
  servingSize: string;
}

export const useFoodForm = () => {
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [servingSize, setServingSize] = useState('');
  const [errors, setErrors] = useState<FormErrors>({
    foodName: '',
    quantity: '',
    servingSize: '',
  });

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {
      foodName: '',
      quantity: '',
      servingSize: '',
    };

    let isValid = true;

    // Validate food name
    if (!foodName.trim()) {
      newErrors.foodName = 'Food name is required';
      isValid = false;
    } else if (foodName.trim().length < 2) {
      newErrors.foodName = 'Food name must be at least 2 characters';
      isValid = false;
    }

    // Validate quantity
    if (!quantity.trim()) {
      newErrors.quantity = 'Quantity is required';
      isValid = false;
    } else if (isNaN(Number(quantity)) || Number(quantity) <= 0) {
      newErrors.quantity = 'Quantity must be a positive number';
      isValid = false;
    }

    // Validate serving size
    if (!servingSize.trim()) {
      newErrors.servingSize = 'Serving size is required';
      isValid = false;
    } else if (servingSize.trim().length < 2) {
      newErrors.servingSize = 'Serving size must be at least 2 characters';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const resetForm = () => {
    setFoodName('');
    setQuantity('');
    setServingSize('');
    setSelectedFood(null);
    setErrors({
      foodName: '',
      quantity: '',
      servingSize: '',
    });
  };

  const populateForm = (item: FoodItem) => {
    setSelectedFood(item);
    setFoodName(item.name);
    setQuantity(item.quantity);
    setServingSize(item.servingSize);
    setErrors({
      foodName: '',
      quantity: '',
      servingSize: '',
    });
  };

  const clearError = (field: keyof FormErrors) => {
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  return {
    // State
    selectedFood,
    foodName,
    quantity,
    servingSize,
    errors,
    // Setters
    setFoodName,
    setQuantity,
    setServingSize,
    // Functions
    validateForm,
    resetForm,
    populateForm,
    clearError,
  };
};
