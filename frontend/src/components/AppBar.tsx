import React from 'react';
import { HStack } from './ui/hstack';
import { Text } from './ui/text';
import { User } from 'lucide-react-native';
import { Button } from './ui/button';
import { Divider } from './ui/divider';
import { View } from 'react-native';

interface AppBarProps {
  title: string;
  /** Optional right-side action element. Replaces the default profile button when provided. */
  action?: React.ReactNode;
}

const AppBar: React.FC<AppBarProps> = ({ title, action }) => {
  return (
    <View>
      <HStack className="justify-between items-center w-full px-6 pb-4">
        <Text size="2xl" className="font-bold text-gray-900">
          {title}
        </Text>
        {action ?? (
          <Button
            className="w-10 h-10 flex items-center justify-center rounded-full"
            style={{ backgroundColor: '#D1FAE5' }}
            aria-label="Profile"
          >
            <User size={20} stroke="#10B981" />
          </Button>
        )}
      </HStack>
      <Divider className="h-[2px] bg-gray-200" />
    </View>
  );
};

export default AppBar;
