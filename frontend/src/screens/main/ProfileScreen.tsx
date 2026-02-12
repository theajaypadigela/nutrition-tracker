import React, { use } from 'react';
import { VStack } from '../../components/ui/vstack';
import { ChevronDownIcon, LogOut, User } from 'lucide-react-native';
import { View } from 'react-native';
import { Text } from '../../components/ui/text';
import { HStack } from '../../components/ui/hstack';
import { Button, ButtonText } from '../../components/ui/button';
import { Input, InputField } from '../../components/ui/input';
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
import { RouteProp } from '@react-navigation/native';
import { MainTabParamList } from '../../navigation/MainTabNavigator';
import { useAuth } from '@/src/context/AuthContext';

type ProfileScreenRouteProp = RouteProp<MainTabParamList, 'Profile'>;

const ProfileScreen = ({ route }: { route: ProfileScreenRouteProp }) => {
  const { name, age, gender } = useAuth().user || {};
  
  const [isEditing, setIsEditing] = React.useState(false);
  const [form, setForm] = React.useState({
    name,
    age,
    gender,
  });
  const handleEditPress = () => {
    setIsEditing(prev => !prev);
  };
  const handleCancelPress = (): void => {
    setIsEditing(false);
  };
  const handleSavePress = () => {
    setIsEditing(false);
  };

  return (
    <VStack className="gap-6 p-6">
      <VStack className="bg-white rounded-2xl p-10 border border-gray-200 items-center">
        <View className="flex justify-center mb-4">
          <View className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
            <User size={36} color="#059669" />
          </View>
        </View>
        <Text size="2xl" className="font-semibold text-gray-900 text-center">
          {name}
        </Text>
        <Text size="md" className="text-gray-600 mt-1 text-center">
          Personal Information
        </Text>
      </VStack>
      <VStack className="bg-white rounded-2xl p-6 border border-gray-200 gap-6">
        <HStack className="justify-between">
          <Text size='xl' className='font-semibold'>Personal Details</Text>
          <Button variant="link" action="positive" onPress={handleEditPress}>
            <ButtonText size="md">{isEditing ? 'Save' : 'Edit'}</ButtonText>
          </Button>
        </HStack>
        <VStack className="gap-2">
          <Text>Full Name </Text>
          <Input
            isDisabled={!isEditing}
            size="xl"
            className={`
                w-full px-4 h-14 rounded-xl border-2
                text-gray-900 placeholder:text-gray-400
                bg-white
              `}
          >
            <InputField
              type="text"
              value={form.name}
              placeholder="Enter your name.."
              onChangeText={text => setForm(prev => ({ ...prev, name: text }))}
            />
          </Input>
        </VStack>
        <VStack className="gap-2">
          <Text>Age</Text>
          <Input
            size="xl"
            isDisabled={!isEditing}
            className={`
                w-full px-4 h-14 rounded-xl border-2
                text-gray-900 placeholder:text-gray-400
                bg-white
              `}
          >
            <InputField
              type="text"
              value={form.age}
              placeholder="Enter your age.."
              onChangeText={text => setForm(prev => ({ ...prev, age: text }))}
            />
          </Input>
        </VStack>
        <VStack className="gap-2">
          <Text>Gender </Text>
          <Select
            isDisabled={!isEditing}
            selectedValue={form.gender}
            onValueChange={value => {
              setForm(prev => ({ ...prev, gender: value }));
            }}
            className="w-full"
          >
            <SelectTrigger
              className={`w-full px-4 h-14 rounded-xl border-2 bg-white}`}
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
        </VStack>
        {isEditing && (
          <HStack className="w-full gap-3">
            <Button
              className="flex-1"
              variant="outline"
              action="primary"
              onPress={handleCancelPress}
            >
              <ButtonText>Cancel</ButtonText>
            </Button>

            <Button
              className="flex-1"
              variant="solid"
              action="positive"
              onPress={handleSavePress}
            >
              <ButtonText>Save</ButtonText>
            </Button>
          </HStack>
        )}
      </VStack>

      <View>
        <Button
          variant="outline"
          action="negative"
          className="w-full mt-4 rounded-xl shadow-lg border border-red-200 bg-gray-50"
          onPress={() => {}}
        >
          <LogOut size={20} color="#ef4444" />
          <ButtonText size="md" className="text-red-500">
            Logout
          </ButtonText>
        </Button>
      </View>
    </VStack>
  );
};

export default ProfileScreen;
