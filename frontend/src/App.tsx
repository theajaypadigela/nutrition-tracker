import * as React from 'react';
import 'react-native-gesture-handler';
import { GluestackUIProvider } from './components/ui/gluestack-ui-provider';
import { AuthProvider } from './context/AuthContext';
import { AppNavigator } from './navigation/AppNavigator';

function App() {
  return (
    <GluestackUIProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </GluestackUIProvider>
  );
}

export default App;
