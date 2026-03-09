import * as React from 'react';
import 'react-native-gesture-handler';
import { AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GluestackUIProvider } from './components/ui/gluestack-ui-provider';
import { AuthProvider } from './context/AuthContext';
import { AppNavigator, navigationRef } from './navigation/AppNavigator';
import { setupNotifeeChannels } from './services/notifee.bootstrap';
import notifee, { EventType } from '@notifee/react-native';

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
  if (type === EventType.ACTION_PRESS) {
    if (detail.pressAction?.id === 'decline') {
      await notifee.cancelNotification(detail.notification!.id!);
    }
    if (detail.pressAction?.id === 'accept') {
      await notifee.cancelNotification(detail.notification!.id!);
      const data = detail.notification?.data;
      if (data?.screen === 'IncomingHabitCall') {
        pendingAcceptNavigation = {
          habitId: data.habitId as string,
          habitName: data.habitName as string,
          habitTime: data.habitTime as string,
          screen: 'VoiceHabit',
        };
      } else {
        pendingAcceptNavigation = {
          mealSlotId: (data?.mealSlotId as string) || 'daily',
          screen: 'VoiceMealLog',
        };
      }
    }
  }
});

function App() {
  React.useEffect(() => {
    setupNotifeeChannels();
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

      if (data?.screen === 'IncomingHabitCall') {
        const screen = isAccept ? 'VoiceHabit' : 'IncomingHabitCall';
        const params = isAccept
          ? {
              habitId: data.habitId,
              habitName: data.habitName,
              habitTime: data.habitTime,
              autoStart: true,
            }
          : {
              habitId: data.habitId,
              habitName: data.habitName,
              habitTime: data.habitTime,
              autoAccept: false,
            };

        const tryNavigate = () => {
          if (navigationRef.isReady()) {
            (navigationRef as any).current?.reset({
              index: 0,
              routes: [{ name: 'MainTabs' }, { name: screen, params }],
            });
          } else {
            setTimeout(tryNavigate, 150);
          }
        };
        tryNavigate();
      } else if (data?.screen === 'IncomingMealCall') {
        const mealSlotId = data.mealSlotId as string;
        const screen = isAccept ? 'VoiceMealLog' : 'IncomingMealCall';
        const params = isAccept
          ? { mealSlotId, autoStart: true }
          : { mealSlotId, autoAccept: false };

        const tryNavigate = () => {
          if (navigationRef.isReady()) {
            (navigationRef as any).current?.reset({
              index: 0,
              routes: [{ name: 'MainTabs' }, { name: screen, params }],
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

      // Habit call notifications
      if (data?.screen === 'IncomingHabitCall') {
        if (type === EventType.DELIVERED || type === EventType.PRESS) {
          (navigationRef as any).current?.navigate('IncomingHabitCall', {
            habitId: data.habitId,
            habitName: data.habitName,
            habitTime: data.habitTime,
            autoAccept: false,
          });
        }
        if (type === EventType.ACTION_PRESS) {
          if (detail.pressAction?.id === 'accept') {
            notifee
              .cancelNotification(detail.notification!.id!)
              .catch(() => {});
            (navigationRef as any).current?.navigate('VoiceHabit', {
              habitId: data.habitId,
              habitName: data.habitName,
              habitTime: data.habitTime,
              autoStart: true,
            });
          }
          if (detail.pressAction?.id === 'decline') {
            notifee
              .cancelNotification(detail.notification!.id!)
              .catch(() => {});
          }
        }
        return;
      }

      // Meal call notifications (existing behavior)
      if (type === EventType.DELIVERED && data?.screen === 'IncomingMealCall') {
        (navigationRef as any).current?.navigate('IncomingMealCall', {
          mealSlotId: data.mealSlotId,
          autoAccept: false,
        });
      }

      if (type === EventType.PRESS && data?.screen === 'IncomingMealCall') {
        (navigationRef as any).current?.navigate('IncomingMealCall', {
          mealSlotId: data.mealSlotId,
          autoAccept: false,
        });
      }

      if (type === EventType.ACTION_PRESS) {
        if (detail.pressAction?.id === 'accept') {
          notifee.cancelNotification(detail.notification!.id!).catch(() => {});
          (navigationRef as any).current?.navigate('VoiceMealLog', {
            mealSlotId: data?.mealSlotId,
            autoStart: true,
          });
        }
        if (detail.pressAction?.id === 'decline') {
          notifee.cancelNotification(detail.notification!.id!).catch(() => {});
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
