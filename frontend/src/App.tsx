import * as React from 'react';
import 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GluestackUIProvider } from './components/ui/gluestack-ui-provider';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppNavigator } from './navigation/AppNavigator';
import { handleAcceptCall, handleDeclineCall } from './hooks/useIncomingCall';
import IncomingCallBanner from './components/IncomingCallBanner';
import { useNotificationInit } from './hooks/notifications/useNotificationInit';
import { useIncomingCallBanner } from './hooks/notifications/useIncomingCallBanner';
import { useReminderReconciliation } from './hooks/notifications/useReminderReconciliation';
import { usePendingAcceptNavigation } from './hooks/notifications/usePendingAcceptNavigation';
import { useColdStartNotification } from './hooks/notifications/useColdStartNotification';
import { useForegroundNotificationEvents } from './hooks/notifications/useForegroundNotificationEvents';

function AppShell() {
  const { isAuthenticated, isInitializing } = useAuth();

  // Lifecycle hooks are invoked in the SAME order as the original effects to preserve
  // registration order: init -> banner callback -> reconciliation -> pending-nav consume
  // -> cold-start tap recovery -> foreground events.
  useNotificationInit();
  const { callBannerPayload, handleBannerExpand } = useIncomingCallBanner();
  useReminderReconciliation(isInitializing, isAuthenticated);
  usePendingAcceptNavigation();
  useColdStartNotification();
  useForegroundNotificationEvents();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <AppNavigator />
      <IncomingCallBanner
        payload={callBannerPayload}
        onAccept={payload => handleAcceptCall(payload).catch(() => {})}
        onDecline={payload => handleDeclineCall(payload).catch(() => {})}
        onExpand={handleBannerExpand}
      />
    </SafeAreaView>
  );
}

function App() {
  return (
    <GluestackUIProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </GluestackUIProvider>
  );
}

export default App;
