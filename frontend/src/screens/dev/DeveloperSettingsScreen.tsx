import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Alert,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Settings, Wifi, Trash2, ArrowLeft, Check } from 'lucide-react-native';
import { Text } from '../../components/ui/text';
import { VStack } from '../../components/ui/vstack';
import { HStack } from '../../components/ui/hstack';
import { Input, InputField } from '../../components/ui/input';
import { Button, ButtonText } from '../../components/ui/button';
import { Divider } from '../../components/ui/divider';
import { CUSTOM_BASE_URL_KEY, DEFAULT_BASE_URL } from '../../api/client';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

type DeveloperSettingsNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'DeveloperSettings'
>;

const DeveloperSettingsScreen = () => {
  const navigation = useNavigation<DeveloperSettingsNavigationProp>();
  const [baseURL, setBaseURL] = useState('');
  const [savedURL, setSavedURL] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSavedURL();
  }, []);

  const loadSavedURL = async () => {
    try {
      const stored = await AsyncStorage.getItem(CUSTOM_BASE_URL_KEY);
      setSavedURL(stored);
      if (stored) {
        setBaseURL(stored);
      }
    } catch (error) {
      console.error('Failed to load custom base URL:', error);
    }
  };

  const handleSave = async () => {
    const trimmed = baseURL.trim();

    if (!trimmed) {
      Alert.alert('Validation Error', 'Please enter a valid Base URL.');
      return;
    }

    // Basic URL format validation
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      Alert.alert(
        'Validation Error',
        'URL must start with http:// or https://',
      );
      return;
    }

    try {
      // Ensure URL ends with a slash
      const normalised = trimmed.endsWith('/') ? trimmed : trimmed + '/';
      await AsyncStorage.setItem(CUSTOM_BASE_URL_KEY, normalised);
      setSavedURL(normalised);
      setBaseURL(normalised);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch {
      Alert.alert('Error', 'Failed to save Base URL.');
    }
  };

  const handleClear = async () => {
    Alert.alert(
      'Clear Custom Base URL',
      'This will revert to the default Base URL. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(CUSTOM_BASE_URL_KEY);
              setSavedURL(null);
              setBaseURL('');
            } catch {
              Alert.alert('Error', 'Failed to clear Base URL.');
            }
          },
        },
      ],
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSavedURL();
    setRefreshing(false);
  };

  return (
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
          <View className="flex-row items-center gap-2">
            <View className="w-8 h-8 bg-amber-100 rounded-lg items-center justify-center">
              <Settings size={18} stroke="#D97706" />
            </View>
            <Text className="text-xl font-bold text-gray-900">
              Developer Settings
            </Text>
          </View>
        </HStack>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <VStack className="p-6 gap-6">
          {/* Warning banner */}
          <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <HStack className="items-center gap-2 mb-1">
              <Settings size={16} stroke="#D97706" />
              <Text className="text-sm font-semibold text-amber-700">
                Developer Mode
              </Text>
            </HStack>
            <Text className="text-xs text-amber-600">
              These settings are for development and testing only. Changing the
              Base URL will affect all API calls made by the application.
            </Text>
          </View>

          {/* Base URL Card */}
          <View className="bg-white rounded-2xl border border-gray-200 p-5">
            <HStack className="items-center gap-2 mb-4">
              <Wifi size={18} stroke="#3B82F6" />
              <Text className="text-base font-semibold text-gray-900">
                API Base URL
              </Text>
            </HStack>

            <Divider className="mb-4" />

            {/* Current saved URL */}
            <VStack className="gap-1 mb-4">
              <Text className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Active URL
              </Text>
              <View className="bg-gray-50 rounded-xl p-3">
                <Text
                  className="text-sm text-gray-700 font-mono"
                  numberOfLines={2}
                >
                  {savedURL ?? DEFAULT_BASE_URL}
                </Text>
              </View>
              {!savedURL && (
                <Text className="text-xs text-gray-400 mt-1">
                  Using default URL
                </Text>
              )}
              {!!savedURL && (
                <Text className="text-xs text-emerald-600 mt-1">
                  ✓ Custom URL is active
                </Text>
              )}
            </VStack>

            {/* Input */}
            <VStack className="gap-2 mb-4">
              <Text className="text-sm font-medium text-gray-700">
                New Base URL
              </Text>
              <Input
                variant="outline"
                size="lg"
                className="rounded-xl border-2 border-gray-200 bg-white"
              >
                <InputField
                  value={baseURL}
                  onChangeText={setBaseURL}
                  placeholder={DEFAULT_BASE_URL}
                  autoCapitalize="none"
                  keyboardType="url"
                  autoCorrect={false}
                />
              </Input>
              <Text className="text-xs text-gray-400">
                Example: http://192.168.1.100:8080/
              </Text>
            </VStack>

            {/* Action buttons */}
            <VStack className="gap-3">
              <Button
                variant="solid"
                size="lg"
                className="w-full rounded-xl bg-blue-500"
                onPress={handleSave}
              >
                <HStack className="items-center gap-2">
                  {isSaved ? <Check size={16} stroke="white" /> : null}
                  <ButtonText className="text-white font-medium">
                    {isSaved ? 'Saved!' : 'Save Base URL'}
                  </ButtonText>
                </HStack>
              </Button>

              {!!savedURL && (
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full rounded-xl border-red-200"
                  onPress={handleClear}
                >
                  <HStack className="items-center gap-2">
                    <Trash2 size={16} stroke="#EF4444" />
                    <ButtonText className="text-red-500 font-medium">
                      Clear Custom URL
                    </ButtonText>
                  </HStack>
                </Button>
              )}
            </VStack>
          </View>

          {/* Default URL info */}
          <View className="bg-white rounded-2xl border border-gray-200 p-5">
            <Text className="text-sm font-semibold text-gray-900 mb-2">
              Default URLs
            </Text>
            <Divider className="mb-3" />
            <VStack className="gap-2">
              <HStack className="justify-between">
                <Text className="text-xs text-gray-500">
                  Android (Emulator)
                </Text>
                <Text className="text-xs font-mono text-gray-700">
                  http://10.0.2.2:8080/
                </Text>
              </HStack>
              <HStack className="justify-between">
                <Text className="text-xs text-gray-500">iOS (Simulator)</Text>
                <Text className="text-xs font-mono text-gray-700">
                  http://localhost:8080/
                </Text>
              </HStack>
            </VStack>
          </View>
        </VStack>
      </ScrollView>
    </View>
  );
};

export default DeveloperSettingsScreen;
