import React from 'react';
import { VStack } from '../../components/ui/vstack';
import { ChevronDownIcon, LogOut, User } from 'lucide-react-native';
import {
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
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
import { useAuth } from '@/src/context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import AppBar from '../../components/AppBar';

const ProfileScreen = () => {
  const { name, age, gender } = useAuth().user || {};
  const { updateProfile, isLoading, logout } = useAuth();
  const navigation = useNavigation<any>();

  const [isEditing, setIsEditing] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [form, setForm] = React.useState({
    name: name || '',
    age: age || '',
    gender: gender || '',
  });

  // Update form when user data changes
  React.useEffect(() => {
    setForm({
      name: name || '',
      age: age || '',
      gender: gender || '',
    });
  }, [name, age, gender]);

  const handleEditPress = () => {
    setIsEditing(prev => !prev);
  };

  const handleCancelPress = (): void => {
    setForm({
      name: name || '',
      age: age || '',
      gender: gender || '',
    });
    setIsEditing(false);
  };

  const handleSavePress = async () => {
    try {
      await updateProfile(form.name, form.age, form.gender);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
      // You can add error notification here
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setForm({
      name: name || '',
      age: age || '',
      gender: gender || '',
    });
    setRefreshing(false);
  };

  return (
    <View className="flex-1">
      <AppBar title="Profile" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <VStack className="gap-6 p-6">
          <VStack className="bg-white rounded-2xl p-10 border border-gray-200 items-center">
            <View className="flex justify-center mb-4">
              <View className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                <User size={36} color="#059669" />
              </View>
            </View>
            <Text
              size="2xl"
              className="font-semibold text-gray-900 text-center"
            >
              {name}
            </Text>
            <Text size="md" className="text-gray-600 mt-1 text-center">
              Personal Information
            </Text>
          </VStack>
          <VStack className="bg-white rounded-2xl p-6 border border-gray-200 gap-6">
            <HStack className="justify-between">
              <Text size="xl" className="font-semibold">
                Personal Details
              </Text>
              <Button
                variant="link"
                action="positive"
                onPress={isEditing ? handleSavePress : handleEditPress}
                isDisabled={isLoading}
              >
                <ButtonText size="md">
                  {isLoading ? 'Saving...' : isEditing ? 'Save' : 'Edit'}
                </ButtonText>
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
                  onChangeText={text =>
                    setForm(prev => ({ ...prev, name: text }))
                  }
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
                  onChangeText={text =>
                    setForm(prev => ({ ...prev, age: text }))
                  }
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
                  isDisabled={isLoading}
                >
                  <ButtonText>Cancel</ButtonText>
                </Button>

                <Button
                  className="flex-1"
                  variant="solid"
                  action="positive"
                  onPress={handleSavePress}
                  isDisabled={isLoading}
                >
                  <ButtonText>{isLoading ? 'Saving...' : 'Save'}</ButtonText>
                </Button>
              </HStack>
            )}
          </VStack>

          <TouchableOpacity
            style={profileStyles.mealReminderRow}
            onPress={() => navigation.navigate('MealSchedule')}
          >
            <Text style={profileStyles.rowIcon}>🔔</Text>
            <Text style={profileStyles.rowLabel}>Meal Reminders</Text>
            <Text style={profileStyles.rowChevron}>›</Text>
          </TouchableOpacity>

          <View>
            <Button
              variant="outline"
              action="negative"
              className="w-full mt-4 rounded-xl shadow-lg border border-red-200 bg-gray-50"
              onPress={logout}
            >
              <LogOut size={20} color="#ef4444" />
              <ButtonText size="md" className="text-red-500">
                Logout
              </ButtonText>
            </Button>
          </View>
        </VStack>
      </ScrollView>
    </View>
  );
};

const profileStyles = StyleSheet.create({
  mealReminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  rowIcon: { fontSize: 22, marginRight: 12 },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  rowChevron: { fontSize: 22, color: '#999' },
});

export default ProfileScreen;
