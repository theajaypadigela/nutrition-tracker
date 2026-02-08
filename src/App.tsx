import React, { useState } from 'react';
import {
  View,
  Text,
  useColorScheme,
  StyleSheet,
  FlatList,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [count, setCount] = React.useState(0);
  return (
    <View style={{ padding: 40 }}>
      <Pressable onPress={() => setCount(prev => prev + 1)}>
        <Text>click me {count}</Text>
      </Pressable>
    </View>
  );
}
export default App;
