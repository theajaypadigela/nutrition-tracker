import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { navigationRef } from '@/navigation/navigationRef';
import {
  navigateToIncomingCall,
  navigateToVoiceHabit,
  navigateToVoiceMealLog,
} from '@/navigation/navigationUtils';
import {
  subscribeToPendingNavigation,
  takePendingAcceptNavigation,
  type PendingAcceptNavigation,
} from '@/navigation/pendingNavigation';

/** Consume a persisted call navigation recorded by a background/headless handler. */
export function usePendingAcceptNavigation(
  isInitializing: boolean,
  isAuthenticated: boolean,
) {
  useEffect(() => {
    // IncomingCall/Voice* live only in the authenticated root stack. Do not atomically take and
    // clear the durable hand-off until that stack can actually accept the navigation.
    if (Platform.OS !== 'ios' || isInitializing || !isAuthenticated) return;
    let disposed = false;
    let readinessTimer: ReturnType<typeof setTimeout> | undefined;
    let pollingTimer: ReturnType<typeof setTimeout> | undefined;

    const navigateWhenReady = (pending: PendingAcceptNavigation) => {
      if (disposed) return;
      if (!navigationRef.isReady()) {
        readinessTimer = setTimeout(() => navigateWhenReady(pending), 150);
        return;
      }

      if (pending.screen === 'IncomingCall') {
        navigateToIncomingCall(pending.payload);
      } else if (pending.screen === 'VoiceHabit') {
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

    const consumePending = async (): Promise<boolean> => {
      const pending = await takePendingAcceptNavigation();
      if (disposed || !pending) return false;
      navigateWhenReady(pending);
      return true;
    };

    // A UI bridge can mount just before a separate Notifee headless bridge finishes its
    // AsyncStorage write. Brief polling closes that cross-runtime write-after-first-read race.
    const pollForLateHeadlessWrite = () => {
      if (pollingTimer) clearTimeout(pollingTimer);
      const deadline = Date.now() + 3_000;
      const poll = async () => {
        const consumed = await consumePending().catch(() => false);
        if (disposed || consumed || Date.now() >= deadline) return;
        pollingTimer = setTimeout(poll, 250);
      };
      poll().catch(() => {});
    };

    // Consume immediately on mount (cold start) and on every resume.
    pollForLateHeadlessWrite();
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') pollForLateHeadlessWrite();
    });
    const unsubscribePending = subscribeToPendingNavigation(() => {
      consumePending().catch(() => {});
    });
    return () => {
      disposed = true;
      if (readinessTimer) clearTimeout(readinessTimer);
      if (pollingTimer) clearTimeout(pollingTimer);
      subscription.remove();
      unsubscribePending();
    };
  }, [isAuthenticated, isInitializing]);
}
