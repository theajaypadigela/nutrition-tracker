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

function AppShell() {
  const { isAuthenticated, isInitializing } = useAuth();

  // Notification lifecycle: init channels -> reconcile schedule -> consume pending Accept (iOS)
  // -> cold-start action recovery (iOS) -> foreground events -> consume native call answers
  // (Android, the full-screen-call platform). The incoming call itself is drawn by the native
  // IncomingCallActivity (see android/.../incomingcall), so there is no in-app call surface here.
  useNotificationInit();
  useReminderReconciliation(isInitializing, isAuthenticated);
  usePendingAcceptNavigation();
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
