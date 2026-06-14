import * as React from 'react';
import 'react-native-gesture-handler';
import { AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GluestackUIProvider } from './components/ui/gluestack-ui-provider';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppNavigator, navigationRef } from './navigation/AppNavigator';
import { ROUTES } from './navigation/routeNames';
import {
  navigateToIncomingCall,
  navigateToVoiceHabit,
  navigateToVoiceMealLog,
  resetToIncomingCall,
} from './navigation/navigationUtils';
import { takePendingAcceptNavigation } from './navigation/pendingNavigation';
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
import { initReminders, reconcileReminders } from './services/notifications/reminderService';
import {
  readOccurrenceData,
  onCallDelivered,
  type OccurrenceData,
} from './services/notifications/callLifecycle';
import { claimAction } from './services/notifications/processedActions';
import { reminderLog } from './services/notifications/logger';

/** Builds the call payload the UI/handlers use from a notification's data bag. */
function payloadFromData(
  data: Record<string, any> | undefined,
  notificationId: string | undefined,
  occ: OccurrenceData,
): IncomingCallPayload {
  if (occ.kind === 'meal-call') {
    return {
      type: 'meal',
      notificationId,
      mealSlotId: (data?.mealSlotId as string | undefined) || 'daily',
      reminderKind: 'meal-call',
      intendedFireAt: occ.intendedFireAt,
      slotKey: occ.slotKey,
      isRescheduled: occ.isRescheduled,
    };
  }
  return {
    type: 'habit',
    notificationId,
    habitId: occ.habitId,
    habitName: occ.habitName,
    habitTime: occ.habitTime,
    reminderKind: occ.kind,
    intendedFireAt: occ.intendedFireAt,
    slotKey: occ.slotKey,
    isRescheduled: occ.isRescheduled,
  };
}

function AppShell() {
  const { isAuthenticated, isInitializing } = useAuth();
  const [callBannerPayload, setCallBannerPayload] =
    React.useState<IncomingCallPayload | null>(null);

  // One-time startup: channels + iOS categories.
  React.useEffect(() => {
    initReminders().catch(e => reminderLog.warn('init.failed', String(e)));
  }, []);

  // Wire the banner callback so handleAccept/handleDecline can dismiss it.
  React.useEffect(() => {
    registerCallBannerCallback(setCallBannerPayload);
  }, []);

  // Reconciliation: cold start once auth is known, and on every foreground resume.
  React.useEffect(() => {
    if (isInitializing) return;
    reconcileReminders('cold-start', isAuthenticated).catch(e =>
      reminderLog.warn('reconcile.cold_start_failed', String(e)),
    );

    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') {
        reconcileReminders('resume', isAuthenticated).catch(e =>
          reminderLog.warn('reconcile.resume_failed', String(e)),
        );
      }
    });
    return () => sub.remove();
  }, [isInitializing, isAuthenticated]);

  // Consume a pending Accept navigation recorded by the background handler on resume.
  React.useEffect(() => {
    const consumePending = () => {
      const pending = takePendingAcceptNavigation();
      if (!pending) return;
      // Poll for navigator readiness rather than relying on a future AppState event —
      // if the navigator becomes ready while the app stays 'active', no further event
      // fires and the pending navigation would otherwise be lost.
      const run = () => {
        if (!navigationRef.isReady()) {
          setTimeout(run, 150);
          return;
        }
        if (pending.screen === 'VoiceHabit') {
          navigateToVoiceHabit({
            habitId: pending.habitId,
            habitName: pending.habitName,
            habitTime: pending.habitTime,
            autoStart: true,
          });
        } else {
          navigateToVoiceMealLog({
            mealSlotId: pending.mealSlotId,
            autoStart: true,
          });
        }
      };
      run();
    };

    // Consume immediately on mount (cold start) and on every resume.
    consumePending();
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') consumePending();
    });
    return () => subscription.remove();
  }, []);

  // Cold-start tap recovery. Deduped against the background handler (P0 #5).
  React.useEffect(() => {
    notifee.getInitialNotification().then(async initialNotification => {
      if (!initialNotification) return;
      const data = initialNotification.notification?.data as
        | Record<string, any>
        | undefined;
      const notificationId = initialNotification.notification?.id;
      const actionId = initialNotification.pressAction?.id;
      const occ = readOccurrenceData(data);

      if (notificationId) setActiveCallNotificationId(notificationId);

      const isAccept = actionId === 'accept';
      const isDecline = actionId === 'decline';

      if (isAccept || isDecline) {
        const claimed = await claimAction(`${notificationId ?? 'unknown'}:${actionId}`);
        if (!claimed) return; // background handler already processed this action
        const payload = payloadFromData(data, notificationId, occ);
        if (isAccept) {
          handleAcceptCall(payload).catch(() => {});
        } else {
          handleDeclineCall(payload).catch(() => {});
        }
        return;
      }

      // Body tap (no action): open the full-screen incoming call.
      const params = {
        notificationId,
        autoAccept: false,
        ...(occ.kind === 'meal-call'
          ? { mealSlotId: data?.mealSlotId }
          : {
              habitId: occ.habitId,
              habitName: occ.habitName,
              habitTime: occ.habitTime,
            }),
      };
      const target =
        occ.kind === 'meal-call'
          ? ROUTES.INCOMING_MEAL_CALL
          : ROUTES.INCOMING_HABIT_CALL;
      const tryNavigate = () => {
        if (navigationRef.isReady()) {
          resetToIncomingCall(target, params);
        } else {
          setTimeout(tryNavigate, 150);
        }
      };
      tryNavigate();
    });
  }, []);

  // Foreground events.
  React.useEffect(() => {
    return notifee.onForegroundEvent(({ type, detail }) => {
      const data = detail.notification?.data as Record<string, any> | undefined;
      const notificationId = detail.notification?.id;
      const occ = readOccurrenceData(data);

      if (notificationId) setActiveCallNotificationId(notificationId);

      const isCall = occ.kind === 'meal-call' || occ.kind === 'habit-call';
      if (!isCall) return;

      if (type === EventType.DELIVERED) {
        // Classify staleness and record the in-flight call. A stale fire is suppressed:
        // no in-app ringing banner, a quiet missed record instead.
        onCallDelivered(occ, notificationId)
          .then(({ suppress }) => {
            if (suppress) {
              if (notificationId) {
                notifee.cancelDisplayedNotification(notificationId).catch(() => {});
              }
              return;
            }
            // Display-only cancel (P0 #2): swap the OS notification for the in-app banner
            // WITHOUT deleting the recurring trigger.
            if (notificationId) {
              notifee.cancelDisplayedNotification(notificationId).catch(() => {});
            }
            showCallBanner(payloadFromData(data, notificationId, occ));
          })
          .catch(() => {});
        return;
      }

      if (type === EventType.PRESS) {
        const target =
          occ.kind === 'meal-call'
            ? ROUTES.INCOMING_MEAL_CALL
            : ROUTES.INCOMING_HABIT_CALL;
        navigateToIncomingCall(target, {
          notificationId,
          autoAccept: false,
          ...(occ.kind === 'meal-call'
            ? { mealSlotId: data?.mealSlotId }
            : {
                habitId: occ.habitId,
                habitName: occ.habitName,
                habitTime: occ.habitTime,
              }),
        });
        return;
      }

      if (type === EventType.ACTION_PRESS) {
        const payload = payloadFromData(data, notificationId, occ);
        if (detail.pressAction?.id === 'accept') {
          handleAcceptCall(payload).catch(() => {});
        }
        if (detail.pressAction?.id === 'decline') {
          handleDeclineCall(payload).catch(() => {});
        }
      }
    });
  }, []);

  const handleBannerExpand = (payload: IncomingCallPayload) => {
    setCallBannerPayload(null);
    if (payload.type === 'habit') {
      navigateToIncomingCall(ROUTES.INCOMING_HABIT_CALL, {
        habitId: payload.habitId,
        habitName: payload.habitName,
        habitTime: payload.habitTime,
        notificationId: payload.notificationId,
        autoAccept: false,
      });
    } else {
      navigateToIncomingCall(ROUTES.INCOMING_MEAL_CALL, {
        mealSlotId: payload.mealSlotId,
        notificationId: payload.notificationId,
        autoAccept: false,
      });
    }
  };

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
