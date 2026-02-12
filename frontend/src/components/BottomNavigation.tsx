import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import {
  Home,
  Activity,
  UtensilsCrossed,
  BarChart3,
} from 'lucide-react-native';

// Simple interface for props if you don't have the types file
export interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (id: string) => void;
}

const BottomNavigation = ({
  activeTab,
  onTabChange,
}: BottomNavigationProps) => {
  const tabs = [
    { id: 'Home', label: 'Home', icon: Home },
    { id: 'Habits', label: 'Habits', icon: Activity },
    { id: 'Food', label: 'Food', icon: UtensilsCrossed },
    { id: 'Reports', label: 'Reports', icon: BarChart3 },
  ];

  return (
    <View 
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB', // gray-200
        paddingBottom: 20, // Safe area padding
        paddingTop: 10,
        height: 90, // Adjusted height to accommodate safe area
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 10 }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => onTabChange(tab.id)}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.7}
            >
              <View 
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isActive ? '#ECFDF5' : 'transparent', // emerald-50
                  paddingVertical: 8,
                  paddingHorizontal: 20,
                  borderRadius: 16,
                  gap: 4
                }}
              >
                <Icon
                  size={24}
                  strokeWidth={isActive ? 2.5 : 2}
                  color={isActive ? '#059669' : '#9CA3AF'} // emerald-600 vs gray-400
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: isActive ? '600' : '500',
                    color: isActive ? '#059669' : '#9CA3AF',
                  }}
                >
                  {tab.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default BottomNavigation;