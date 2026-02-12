import React, { useState, useEffect } from "react";
import { TouchableOpacity, Keyboard } from "react-native";
import { Text } from "../ui/text";
import { HStack } from "../ui/hstack";
import { Button, ButtonText } from "../ui/button";
import { CloseIcon, Icon } from "../ui/icon";
import { VStack } from "../ui/vstack";
import { Input, InputField } from "../ui/input";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "../ui/modal";
import { Heading } from "../ui/heading";

interface SetDailyTargetProps {
  showModal: boolean;
  onClose: () => void;
  onSave?: (value: string) => void;
  RecommendedValue?: number;
  unit?: string;
  currentTarget?: number;
}

const SetDailyTarget: React.FC<SetDailyTargetProps> = ({
  showModal,
  onClose,
  onSave,
  RecommendedValue = 100,
  unit = "g",
  currentTarget,
}) => {
  // Local state to manage the input value
  const [targetValue, setTargetValue] = useState("");

  // Sync state when modal opens
  useEffect(() => {
    if (showModal) {
      setTargetValue(String(currentTarget || RecommendedValue || ""));
    }
  }, [showModal, currentTarget, RecommendedValue]);

  const handleSave = () => {
    if (onSave) {
      onSave(targetValue);
    }
    onClose();
  };

  const setRecommended = () => {
    setTargetValue(String(RecommendedValue));
    Keyboard.dismiss();
  };

  return (
    <Modal
      isOpen={showModal}
      onClose={onClose}
      size="md"
    >
      <ModalBackdrop />
      <ModalContent className="bg-white rounded-2xl">
        {/* Header: Title and Close Button */}
        <ModalHeader className="pb-2">
          <Heading size="lg" className="text-typography-900 font-bold">
            Set Daily Target
          </Heading>
          <ModalCloseButton>
            <Icon as={CloseIcon} />
          </ModalCloseButton>
        </ModalHeader>

        <ModalBody>
          <VStack space="lg">
            {/* Description Text */}
            <Text size="sm" className="text-typography-500 leading-sm">
              Your target is used to calculate % progress and weekly insights.
            </Text>

            {/* Section 1: Default RDI Button */}
            <VStack space="xs">
              <Text size="xs" className="font-medium text-typography-500 uppercase">
                Default RDI
              </Text>
              <TouchableOpacity onPress={setRecommended}>
                <VStack
                  className="p-3 border border-outline-200 rounded-lg bg-background-50 active:bg-background-100"
                >
                  <Text className="text-sm text-typography-900">
                    {RecommendedValue} {unit} (Recommended Daily Intake)
                  </Text>
                </VStack>
              </TouchableOpacity>
            </VStack>

            {/* Section 2: Custom Target Input */}
            <VStack space="xs">
              <Text size="xs" className="font-medium text-typography-500 uppercase">
                Custom Target
              </Text>
              <HStack space="md" className="items-center">
                <Input className="flex-1 h-12 border-outline-200">
                  <InputField
                    placeholder="Enter value"
                    value={targetValue}
                    onChangeText={setTargetValue}
                    keyboardType="numeric"
                    returnKeyType="done"
                  />
                </Input>
                {/* Unit Display - You could replace this with a Select if you need to change units */}
                <VStack className="justify-center h-12 px-3 border border-outline-200 rounded-lg bg-background-50">
                   <Text className="font-medium">{unit}</Text>
                </VStack>
              </HStack>
            </VStack>
          </VStack>
        </ModalBody>

        {/* Footer: Action Buttons */}
        <ModalFooter className="mt-4">
          <Button
            variant="outline"
            action="secondary"
            onPress={onClose}
            className="flex-1 mr-2 border-outline-200"
          >
            <ButtonText className="text-typography-500">Cancel</ButtonText>
          </Button>
          <Button
            onPress={handleSave}
            className="flex-1 bg-emerald-500" // Assuming emerald-500 matches your accent color
          >
            <ButtonText className="text-white font-semibold">Save Target</ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default SetDailyTarget;