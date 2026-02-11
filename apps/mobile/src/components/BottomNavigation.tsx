import React from 'react';
import { View } from 'react-native';
import { HStack } from './ui/hstack';
import {
  Home,
  Activity,
  UtensilsCrossed,
  BarChart3,
} from 'lucide-react-native';
import { Button } from './ui/button';
import { Text } from './ui/text';
import { BottomNavigationProps } from '../types/types';

const BottomNavigation = ({
  activeTab,
  onTabChange,
}: BottomNavigationProps) => {
  const tabs = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'habits' as const, label: 'Habits', icon: Activity },
    { id: 'food' as const, label: 'Food', icon: UtensilsCrossed },
    { id: 'reports' as const, label: 'Reports', icon: BarChart3 },
  ];

  return (
    <View className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white">
      <HStack className="h-20 px-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <View key={tab.id} className="flex-1">
              <Button
                onPress={() => onTabChange(tab.id)}
                className={`flex-1 rounded-xl mx-1 ${
                  isActive ? 'bg-emerald-50' : 'bg-transparent'
                }`}
              >
                <View className="flex items-center justify-center gap-1">
                  <Icon
                    size={24}
                    strokeWidth={isActive ? 2.5 : 2}
                    color={isActive ? '#059669' : '#9CA3AF'}
                  />
                  <Text
                    className={`text-xs ${
                      isActive
                        ? 'font-semibold text-emerald-600'
                        : 'font-medium text-gray-400'
                    }`}
                  >
                    {tab.label}
                  </Text>
                </View>
              </Button>
            </View>
          );
        })}
      </HStack>
    </View>
  );
};

export default BottomNavigation;
