import * as React from 'react';
import 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GluestackUIProvider } from './components/ui/gluestack-ui-provider';
import { AuthProvider } from './context/AuthContext';
import { AppNavigator } from './navigation/AppNavigator';

function App() {
  return (
    <GluestackUIProvider>
      <AuthProvider>
        <SafeAreaView className="flex-1 bg-gray-50">
          <AppNavigator />
        </SafeAreaView>
      </AuthProvider>
    </GluestackUIProvider>
  );
}

export default App;
