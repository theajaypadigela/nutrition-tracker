import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import {
  Home,
  Activity,
  UtensilsCrossed,
  BarChart3,
} from 'lucide-react-native';

export interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
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
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <View style={styles.tabRow}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => onTabChange(tab.id)}
                style={styles.tabButton}
                activeOpacity={0.6}
              >
                <View
                  style={[
                    styles.tabContent,
                    isActive && styles.tabContentActive,
                  ]}
                >
                  <Icon
                    size={24}
                    strokeWidth={isActive ? 2.5 : 2}
                    color={isActive ? '#FFFFFF' : '#6B7280'}
                  />
                  <Text
                    style={[
                      styles.label,
                      isActive ? styles.labelActive : styles.labelInactive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingHorizontal: 12,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    paddingVertical: 10,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 4,
    minWidth: 60,
  },
  tabContentActive: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  labelActive: {
    color: '#FFFFFF',
  },
  labelInactive: {
    color: '#9CA3AF',
  },
});

export default BottomNavigation;
