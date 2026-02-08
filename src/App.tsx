import * as React from 'react';
import { Text, View } from 'react-native';
import { Button } from './components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoginScreen } from './components/LoginScreen';

function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LoginScreen />
    </SafeAreaView>
  );
}

export default App;
