import * as React from 'react';
import 'react-native-gesture-handler';
import { AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GluestackUIProvider } from './components/ui/gluestack-ui-provider';
import { AuthProvider } from './context/AuthContext';
import { AppNavigator, navigationRef } from './navigation/AppNavigator';
import { setupNotifeeChannels } from './services/notifee.bootstrap';
import notifee, { EventType } from '@notifee/react-native';
import {
  NOTIFICATION_ACTION_IDS,
  NotificationNavigationTarget,
  notificationBelongsToUser,
  parseCallNotificationPayload,
  resolveNotificationNavigation,
} from './app/notifications/contracts';
import { sessionStore } from './shared/storage/sessionStore';

// Flag set by background handler so the app navigates when it resumes
let pendingAcceptNavigation: {
  target: NotificationNavigationTarget;
  userId: string;
} | null = null;

const cancelDisplayedNotification = async (
  notificationId: string | undefined,
): Promise<void> => {
  if (notificationId) {
    await notifee.cancelDisplayedNotification(notificationId);
  }
};

const navigateToNotificationTarget = (
  target: NotificationNavigationTarget,
): void => {
  switch (target.screen) {
    case 'IncomingMealCall':
      navigationRef.navigate('IncomingMealCall', target.params);
      return;
    case 'VoiceMealLog':
      navigationRef.navigate('VoiceMealLog', target.params);
      return;
    case 'IncomingHabitCall':
      navigationRef.navigate('IncomingHabitCall', target.params);
      return;
    case 'VoiceHabit':
      navigationRef.navigate('VoiceHabit', target.params);
  }
};

const resetToNotificationTarget = (
  target: NotificationNavigationTarget,
): void => {
  switch (target.screen) {
    case 'IncomingMealCall':
      navigationRef.reset({
        index: 1,
        routes: [
          { name: 'MainTabs' },
          { name: 'IncomingMealCall', params: target.params },
        ],
      });
      return;
    case 'VoiceMealLog':
      navigationRef.reset({
        index: 1,
        routes: [
          { name: 'MainTabs' },
          { name: 'VoiceMealLog', params: target.params },
        ],
      });
      return;
    case 'IncomingHabitCall':
      navigationRef.reset({
        index: 1,
        routes: [
          { name: 'MainTabs' },
          { name: 'IncomingHabitCall', params: target.params },
        ],
      });
      return;
    case 'VoiceHabit':
      navigationRef.reset({
        index: 1,
        routes: [
          { name: 'MainTabs' },
          { name: 'VoiceHabit', params: target.params },
        ],
      });
  }
};

// Background handler — runs when app is killed/background
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.ACTION_PRESS) {
    const payload = parseCallNotificationPayload(detail.notification?.data);
    if (!payload) return;

    const currentUserId = await sessionStore.getUserId();
    if (!notificationBelongsToUser(payload, currentUserId)) {
      await cancelDisplayedNotification(detail.notification?.id);
      return;
    }

    if (detail.pressAction?.id === NOTIFICATION_ACTION_IDS.decline) {
      await cancelDisplayedNotification(detail.notification?.id);
    }
    if (detail.pressAction?.id === NOTIFICATION_ACTION_IDS.accept) {
      await cancelDisplayedNotification(detail.notification?.id);
      pendingAcceptNavigation = {
        target: resolveNotificationNavigation(payload, 'accept'),
        userId: payload.userId,
      };
    }
  }
});

function App() {
  React.useEffect(() => {
    setupNotifeeChannels();
  }, []);

  // Handle resume from background after tapping "Accept"
  React.useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      async nextAppState => {
        if (nextAppState === 'active' && pendingAcceptNavigation) {
          const pending = pendingAcceptNavigation;
          pendingAcceptNavigation = null;
          const currentUserId = await sessionStore.getUserId();
          if (pending.userId === currentUserId && navigationRef.isReady()) {
            navigateToNotificationTarget(pending.target);
          }
        }
      },
    );
    return () => subscription.remove();
  }, []);

  React.useEffect(() => {
    // When the app is cold-started by tapping the notification or an action button
    notifee.getInitialNotification().then(async initialNotification => {
      if (!initialNotification) return;
      const payload = parseCallNotificationPayload(
        initialNotification.notification?.data,
      );
      if (!payload) return;

      const currentUserId = await sessionStore.getUserId();
      if (!notificationBelongsToUser(payload, currentUserId)) {
        await cancelDisplayedNotification(initialNotification.notification?.id);
        return;
      }

      const action =
        initialNotification.pressAction?.id === NOTIFICATION_ACTION_IDS.accept
          ? 'accept'
          : 'open';
      const target = resolveNotificationNavigation(payload, action);

      const tryNavigate = async () => {
        if (payload.userId !== (await sessionStore.getUserId())) return;

        if (navigationRef.isReady()) {
          resetToNotificationTarget(target);
        } else {
          setTimeout(() => {
            tryNavigate().catch(() => {});
          }, 150);
        }
      };
      tryNavigate().catch(() => {});
    });
  }, []);

  // Foreground handler
  React.useEffect(() => {
    return notifee.onForegroundEvent(async ({ type, detail }) => {
      const payload = parseCallNotificationPayload(detail.notification?.data);
      if (!payload) return;

      const currentUserId = await sessionStore.getUserId();
      if (!notificationBelongsToUser(payload, currentUserId)) {
        await cancelDisplayedNotification(detail.notification?.id);
        return;
      }

      if (type === EventType.DELIVERED || type === EventType.PRESS) {
        navigateToNotificationTarget(
          resolveNotificationNavigation(payload, 'open'),
        );
      }

      if (type === EventType.ACTION_PRESS) {
        if (detail.pressAction?.id === NOTIFICATION_ACTION_IDS.accept) {
          await cancelDisplayedNotification(detail.notification?.id);
          navigateToNotificationTarget(
            resolveNotificationNavigation(payload, 'accept'),
          );
        }
        if (detail.pressAction?.id === NOTIFICATION_ACTION_IDS.decline) {
          await cancelDisplayedNotification(detail.notification?.id);
        }
      }
    });
  }, []);

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
