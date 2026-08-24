import * as React from 'react';
import 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GluestackUIProvider } from './components/ui/gluestack-ui-provider';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OnboardingProvider } from './context/OnboardingContext';
import { AppNavigator } from './navigation/AppNavigator';
import { useNotificationInit } from './hooks/notifications/useNotificationInit';
import { useReminderReconciliation } from './hooks/notifications/useReminderReconciliation';
import { usePendingAcceptNavigation } from './hooks/notifications/usePendingAcceptNavigation';
import { useColdStartNotification } from './hooks/notifications/useColdStartNotification';
import { useForegroundNotificationEvents } from './hooks/notifications/useForegroundNotificationEvents';
import { useNativeIncomingCallResults } from './hooks/notifications/useNativeIncomingCallResults';
import { useVoipTokenSync } from './hooks/notifications/useVoipTokenSync';

function AppShell() {
  const { isAuthenticated, isInitializing } = useAuth();

  // Notification lifecycle: initialize categories, sync PushKit, reconcile local fallback,
  // recover persisted notification navigation, then consume live/durable native call actions.
  // Android and registered iOS calls use native surfaces; standard iOS body taps intentionally
  // land on the React IncomingCall fallback so voice never starts without an explicit Answer.
  useNotificationInit();
  useVoipTokenSync(isInitializing, isAuthenticated);
  useReminderReconciliation(isInitializing, isAuthenticated);
  usePendingAcceptNavigation(isInitializing, isAuthenticated);
  useColdStartNotification();
  useForegroundNotificationEvents();
  useNativeIncomingCallResults();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <AppNavigator />
    </SafeAreaView>
  );
}

function App() {
  return (
    <GluestackUIProvider>
      {/* Onboarding sits above Auth: registration arms the first-run flow, so
          AuthProvider consumes it rather than owning it. */}
      <OnboardingProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </OnboardingProvider>
    </GluestackUIProvider>
  );
}

export default App;
