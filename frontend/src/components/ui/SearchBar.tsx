import React from 'react';
import { Input, InputField, InputIcon, InputSlot } from '../ui/input';
import { SearchIcon } from 'lucide-react-native';

interface SearchBarProps {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
}

const SearchBar = ({
  value,
  onChangeText,
  placeholder = 'Search here...',
}: SearchBarProps) => {
  return (
    <Input size="md" variant="outline" className="w-full bg-white">
      <InputSlot className="pl-3">
        <InputIcon as={SearchIcon} className="text-typography-500" />
      </InputSlot>
      <InputField
        placeholder={placeholder}
        className="flex-1"
        value={value}
        onChangeText={onChangeText}
      />
    </Input>
  );
};

export default SearchBar;
