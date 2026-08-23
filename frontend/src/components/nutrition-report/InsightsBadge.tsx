import React from 'react';
import { tokens } from '@/theme/tokens';
import { View } from 'react-native';
import { Text } from '../ui/text';
import { TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react-native';
import { HStack } from '../ui/hstack';
import { InsightVariant } from './types';

interface InsightsBadgeProps {
  variant: InsightVariant;
  message: string;
}

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
    color: tokens.insight.positive,
    icon: <TrendingUp size={20} color={tokens.insight.positive} />,
  },
  negative: {
    color: tokens.insight.negative,
    icon: <AlertTriangle size={20} color={tokens.insight.negative} />,
  },
  neutral: {
    color: tokens.insight.neutral,
    icon: <TrendingDown size={20} color={tokens.insight.neutral} />,
  },
};

const InsightsBadge: React.FC<InsightsBadgeProps> = ({
  variant,
  message,
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
