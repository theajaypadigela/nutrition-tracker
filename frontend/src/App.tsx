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
  handleAcceptCall,
  handleDeclineCall,
  registerCallBannerCallback,
  setActiveCallNotificationId,
  showCallBanner,
  type IncomingCallPayload,
} from './hooks/useIncomingCall';
import IncomingCallBanner from './components/IncomingCallBanner';

// Flag set by background handler so the app navigates when it resumes
let pendingAcceptNavigation: {
  mealSlotId?: string;
  habitId?: string;
  habitName?: string;
  habitTime?: string;
  screen: string;
} | null = null;

// Background handler — runs when app is killed/background
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type !== EventType.ACTION_PRESS) {
    return;
  }

  const notificationId = detail.notification?.id;
  const data = detail.notification?.data;

  if (notificationId) {
    setActiveCallNotificationId(notificationId);
  }

  const isHabitCall = data?.screen === 'IncomingHabitCall';
  const payload = isHabitCall
    ? {
        type: 'habit' as const,
        notificationId,
        habitId: data?.habitId as string | undefined,
        habitName: data?.habitName as string | undefined,
        habitTime: data?.habitTime as string | undefined,
      }
    : {
        type: 'meal' as const,
        notificationId,
        mealSlotId: (data?.mealSlotId as string | undefined) || 'daily',
      };

  if (detail.pressAction?.id === 'decline') {
    await handleDeclineCall(payload, { skipNavigation: true });
    return;
  }

  if (detail.pressAction?.id === 'accept') {
    await handleAcceptCall(payload, { skipNavigation: true });

    if (isHabitCall) {
      pendingAcceptNavigation = {
        habitId: data?.habitId as string | undefined,
        habitName: data?.habitName as string | undefined,
        habitTime: data?.habitTime as string | undefined,
        screen: 'VoiceHabit',
      };
    } else {
      pendingAcceptNavigation = {
        mealSlotId: (data?.mealSlotId as string | undefined) || 'daily',
        screen: 'VoiceMealLog',
      };
    }
  }
});

function App() {
  const [callBannerPayload, setCallBannerPayload] =
    React.useState<IncomingCallPayload | null>(null);

  React.useEffect(() => {
    setupNotifeeChannels();
  }, []);

  // Wire the banner callback so handleAccept/handleDecline can dismiss it
  React.useEffect(() => {
    registerCallBannerCallback(setCallBannerPayload);
  }, []);

  // Handle resume from background after tapping "Accept"
  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && pendingAcceptNavigation) {
        const pending = pendingAcceptNavigation;
        pendingAcceptNavigation = null;
        if (navigationRef.isReady()) {
          if (pending.screen === 'VoiceHabit') {
            (navigationRef as any).current?.navigate('VoiceHabit', {
              habitId: pending.habitId,
              habitName: pending.habitName,
              habitTime: pending.habitTime,
              autoStart: true,
            });
          } else {
            (navigationRef as any).current?.navigate('VoiceMealLog', {
              mealSlotId: pending.mealSlotId,
              autoStart: true,
            });
          }
        }
      }
    });
    return () => subscription.remove();
  }, []);

  React.useEffect(() => {
    // When the app is cold-started by tapping the notification or an action button
    notifee.getInitialNotification().then(initialNotification => {
      if (!initialNotification) return;
      const data = initialNotification.notification?.data;
      const isAccept = initialNotification.pressAction?.id === 'accept';
      const notificationId = initialNotification.notification?.id;

      if (notificationId) {
        setActiveCallNotificationId(notificationId);
      }

      if (data?.screen === 'IncomingHabitCall') {
        if (isAccept) {
          handleAcceptCall({
            type: 'habit',
            notificationId,
            habitId: data.habitId as string | undefined,
            habitName: data.habitName as string | undefined,
            habitTime: data.habitTime as string | undefined,
          }).catch(() => {});
          return;
        }

        const params = {
          habitId: data.habitId,
          habitName: data.habitName,
          habitTime: data.habitTime,
          notificationId,
          autoAccept: false,
        };

        const tryNavigate = () => {
          if (navigationRef.isReady()) {
            (navigationRef as any).current?.reset({
              index: 0,
              routes: [{ name: 'MainTabs' }, { name: 'IncomingHabitCall', params }],
            });
          } else {
            setTimeout(tryNavigate, 150);
          }
        };
        tryNavigate();
      } else if (data?.screen === 'IncomingMealCall') {
        if (isAccept) {
          handleAcceptCall({
            type: 'meal',
            notificationId,
            mealSlotId: (data.mealSlotId as string | undefined) || 'daily',
          }).catch(() => {});
          return;
        }

        const mealSlotId = data.mealSlotId as string;
        const params = {
          mealSlotId,
          notificationId,
          autoAccept: false,
        };

        const tryNavigate = () => {
          if (navigationRef.isReady()) {
            (navigationRef as any).current?.reset({
              index: 0,
              routes: [{ name: 'MainTabs' }, { name: 'IncomingMealCall', params }],
            });
          } else {
            setTimeout(tryNavigate, 150);
          }
        };
        tryNavigate();
      }
    });
  }, []);

  // Foreground handler
  React.useEffect(() => {
    return notifee.onForegroundEvent(({ type, detail }) => {
      const data = detail.notification?.data;
      const notificationId = detail.notification?.id;

      if (notificationId) {
        setActiveCallNotificationId(notificationId);
      }

      // ── Habit call ──────────────────────────────────────────────────────────
      if (data?.screen === 'IncomingHabitCall') {
        if (type === EventType.DELIVERED) {
          // Cancel the native notification so the OS banner and the in-app
          // banner don't coexist. Show the custom in-app pill banner instead.
          if (notificationId) {
            notifee.cancelNotification(notificationId).catch(() => {});
          }
          showCallBanner({
            type: 'habit',
            notificationId,
            habitId: data.habitId as string | undefined,
            habitName: data.habitName as string | undefined,
            habitTime: data.habitTime as string | undefined,
          });
          return;
        }

        if (type === EventType.PRESS) {
          // User tapped the notification in the shade — go to full screen.
          (navigationRef as any).current?.navigate('IncomingHabitCall', {
            habitId: data.habitId,
            habitName: data.habitName,
            habitTime: data.habitTime,
            notificationId,
            autoAccept: false,
          });
          return;
        }

        if (type === EventType.ACTION_PRESS) {
          if (detail.pressAction?.id === 'accept') {
            handleAcceptCall({
              type: 'habit',
              notificationId,
              habitId: data.habitId as string | undefined,
              habitName: data.habitName as string | undefined,
              habitTime: data.habitTime as string | undefined,
            }).catch(() => {});
          }
          if (detail.pressAction?.id === 'decline') {
            handleDeclineCall({
              type: 'habit',
              notificationId,
              habitId: data.habitId as string | undefined,
              habitName: data.habitName as string | undefined,
              habitTime: data.habitTime as string | undefined,
            }).catch(() => {});
          }
        }
        return;
      }

      // ── Meal call ───────────────────────────────────────────────────────────
      if (data?.screen === 'IncomingMealCall') {
        if (type === EventType.DELIVERED) {
          // Cancel native notification, show custom in-app banner.
          if (notificationId) {
            notifee.cancelNotification(notificationId).catch(() => {});
          }
          showCallBanner({
            type: 'meal',
            notificationId,
            mealSlotId: (data.mealSlotId as string | undefined) || 'daily',
          });
          return;
        }

        if (type === EventType.PRESS) {
          (navigationRef as any).current?.navigate('IncomingMealCall', {
            mealSlotId: data.mealSlotId,
            notificationId,
            autoAccept: false,
          });
          return;
        }

        if (type === EventType.ACTION_PRESS) {
          if (detail.pressAction?.id === 'accept') {
            handleAcceptCall({
              type: 'meal',
              notificationId,
              mealSlotId: (data?.mealSlotId as string | undefined) || 'daily',
            }).catch(() => {});
          }
          if (detail.pressAction?.id === 'decline') {
            handleDeclineCall({
              type: 'meal',
              notificationId,
              mealSlotId: (data?.mealSlotId as string | undefined) || 'daily',
            }).catch(() => {});
          }
        }
      }
    });
  }, []);

  const handleBannerExpand = (payload: IncomingCallPayload) => {
    // Hide the banner (audio keeps playing — IncomingCallScreen manages it).
    setCallBannerPayload(null);
    if (payload.type === 'habit') {
      (navigationRef as any).current?.navigate('IncomingHabitCall', {
        habitId: payload.habitId,
        habitName: payload.habitName,
        habitTime: payload.habitTime,
        notificationId: payload.notificationId,
        autoAccept: false,
      });
    } else {
      (navigationRef as any).current?.navigate('IncomingMealCall', {
        mealSlotId: payload.mealSlotId,
        notificationId: payload.notificationId,
        autoAccept: false,
      });
    }
  };

  return (
    <GluestackUIProvider>
      <AuthProvider>
        <SafeAreaView className="flex-1 bg-white">
          <AppNavigator />
          <IncomingCallBanner
            payload={callBannerPayload}
            onAccept={payload => handleAcceptCall(payload).catch(() => {})}
            onDecline={payload => handleDeclineCall(payload).catch(() => {})}
            onExpand={handleBannerExpand}
          />
        </SafeAreaView>
      </AuthProvider>
    </GluestackUIProvider>
  );
}

export default App;
