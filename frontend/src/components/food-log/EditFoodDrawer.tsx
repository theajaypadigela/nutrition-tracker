import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Text } from '../ui/text';
import { VStack } from '../ui/vstack';
import { HStack } from '../ui/hstack';
import { Icon, CloseIcon } from '../ui/icon';
import { Button, ButtonText } from '../ui/button';
import { Input, InputField } from '../ui/input';
import {
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
} from '../ui/drawer';
import { Heading } from '../ui/heading';
import { FoodItem, FoodErrors } from './types';

interface EditFoodDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    foodName: string,
    quantity: string,
    servingSize: string,
  ) => Promise<void>;
  initialData: FoodItem | null;
}

export const EditFoodDrawer: React.FC<EditFoodDrawerProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [servingSize, setServingSize] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [errors, setErrors] = useState<FoodErrors>({
    foodName: '',
    quantity: '',
    servingSize: '',
  });

  useEffect(() => {
    if (isOpen && initialData) {
      setFoodName(initialData.name);
      setQuantity(initialData.quantity);
      setServingSize(initialData.servingSize);
      setSaveError('');
    } else if (isOpen) {
      setFoodName('');
      setQuantity('');
      setServingSize('');
      setSaveError('');
    }
  }, [isOpen, initialData]);

  const validateForm = () => {
    const newErrors = {
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

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setSaveError('');

    try {
      await onSave(foodName, quantity, servingSize);
      handleClose();
    } catch {
      setSaveError('Could not save your changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setFoodName('');
    setQuantity('');
    setServingSize('');
    setErrors({
      foodName: '',
      quantity: '',
      servingSize: '',
    });
    setSaveError('');
    onClose();
  };

  return (
    <Drawer isOpen={isOpen} size="lg" anchor="bottom" onClose={handleClose}>
      <DrawerBackdrop />
      <DrawerContent className="bg-white rounded-t-3xl">
        <DrawerHeader className="border-b border-gray-200 pb-4">
          <Heading size="xl" className="text-gray-900 font-bold">
            Edit Food Item
          </Heading>
          <DrawerCloseButton>
            <Icon as={CloseIcon} />
          </DrawerCloseButton>
        </DrawerHeader>

        <DrawerBody className="py-6">
          <VStack space="lg">
            {/* Food Name Field */}
            <VStack space="xs">
              <Text className="text-sm font-semibold text-gray-700 mb-1">
                Food Name
              </Text>
              <Input
                variant="outline"
                size="lg"
                className={`rounded-xl border-2 ${
                  errors.foodName
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <InputField
                  placeholder="Enter food name"
                  value={foodName}
                  onChangeText={text => {
                    setFoodName(text);
                    if (errors.foodName) {
                      setErrors({ ...errors, foodName: '' });
                    }
                  }}
                  className="text-base text-gray-900"
                />
              </Input>
              {errors.foodName ? (
                <Text className="text-xs text-red-600 mt-1">
                  {errors.foodName}
                </Text>
              ) : null}
            </VStack>

            {/* Quantity Field */}
            <VStack space="xs">
              <Text className="text-sm font-semibold text-gray-700 mb-1">
                Quantity
              </Text>
              <Input
                variant="outline"
                size="lg"
                className={`rounded-xl border-2 ${
                  errors.quantity
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <InputField
                  placeholder="Enter quantity (e.g., 1, 2.5)"
                  value={quantity}
                  onChangeText={text => {
                    setQuantity(text);
                    if (errors.quantity) {
                      setErrors({ ...errors, quantity: '' });
                    }
                  }}
                  keyboardType="decimal-pad"
                  className="text-base text-gray-900"
                />
              </Input>
              {errors.quantity ? (
                <Text className="text-xs text-red-600 mt-1">
                  {errors.quantity}
                </Text>
              ) : null}
            </VStack>

            {/* Serving Size Field */}
            <VStack space="xs">
              <Text className="text-sm font-semibold text-gray-700 mb-1">
                Serving Size
              </Text>
              <Input
                variant="outline"
                size="lg"
                className={`rounded-xl border-2 ${
                  errors.servingSize
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <InputField
                  placeholder="Enter serving size (e.g., bowl, cup)"
                  value={servingSize}
                  onChangeText={text => {
                    setServingSize(text);
                    if (errors.servingSize) {
                      setErrors({ ...errors, servingSize: '' });
                    }
                  }}
                  className="text-base text-gray-900"
                />
              </Input>
              {errors.servingSize ? (
                <Text className="text-xs text-red-600 mt-1">
                  {errors.servingSize}
                </Text>
              ) : null}
            </VStack>

            {/* Helper text */}
            <View className="bg-green-50 p-4 rounded-xl border border-green-200">
              <Text className="text-xs text-green-800">
                Tip: Make sure all fields are filled correctly. Quantity should
                be a positive number.
              </Text>
            </View>
            {saveError ? (
              <View className="bg-red-50 p-4 rounded-xl border border-red-200">
                <Text className="text-xs text-red-700">{saveError}</Text>
              </View>
            ) : null}
          </VStack>
        </DrawerBody>

        <DrawerFooter className="border-t border-gray-200 pt-4">
          <HStack space="md" className="w-full">
            <Button
              variant="outline"
              size="lg"
              onPress={handleClose}
              className="flex-1 rounded-xl border-2 border-gray-300"
            >
              <ButtonText className="text-gray-700 font-semibold">
                Cancel
              </ButtonText>
            </Button>
            <Button
              variant="solid"
              size="lg"
              onPress={() => {
                void handleSave();
              }}
              isDisabled={isSaving}
              className="flex-1 rounded-xl bg-green-600"
            >
              <ButtonText className="text-white font-semibold">
                {isSaving ? 'Saving...' : 'Save Changes'}
              </ButtonText>
            </Button>
          </HStack>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
