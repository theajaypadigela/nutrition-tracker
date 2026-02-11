import React from 'react';
import { 
  Input, 
  InputField, 
  InputIcon, 
  InputSlot 
} from '../ui/input';
import { SearchIcon } from 'lucide-react-native';

const SearchBar = () => {
  return (
    <Input size="md" variant="outline" className="w-full bg-white">
      <InputSlot className="pl-3">
        <InputIcon as={SearchIcon} className="text-typography-500" />
      </InputSlot>
      <InputField 
        placeholder="Search here..." 
        className="flex-1"
      />
    </Input>
  );
};

export default SearchBar;