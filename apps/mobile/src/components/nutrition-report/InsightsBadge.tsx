import React from 'react';
import { View } from 'react-native';
import { Text } from '../ui/text';
import { TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react-native';
import { HStack } from '../ui/hstack';

interface Theme {
  positive: {
    color: string;
    icon: React.ReactNode;
  };
  negative: {
    color: string;
    icon: React.ReactNode;
  };
  neutral: {
    color: string;
    icon: React.ReactNode;
  };
}

const theme: Theme = {
  positive: {
    color: '#13961a',
    icon: <TrendingUp size={20} color={'#13961aff'} />,
  },
  negative: {
    color: '#dc2626',
    icon: <AlertTriangle size={20} color={'#dc2626'} />,
  },
  neutral: {
    color: '#d97706',
    icon: <TrendingDown size={20} color={'#d97706'} />,
  },
};

const InsightsBadge = ({
  variant,
  message,
}: {
  variant: 'positive' | 'negative' | 'neutral';
  message: string;
}) => {
  const activeTheme = theme[variant] || theme.neutral;

  return (
    <View
      className="rounded-2xl p-4"
      style={{ backgroundColor: activeTheme.color + '1A', overflow: 'hidden' }}
    >
      <HStack className="gap-3">
        {activeTheme.icon}
        <Text className="text-sm flex-1" style={{ color: activeTheme.color }}>
          {message}
        </Text>
      </HStack>
    </View>
  );
};

export default InsightsBadge;
