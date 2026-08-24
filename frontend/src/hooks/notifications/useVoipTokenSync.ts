import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import {
  getVoipToken,
  subscribeToVoipTokenUpdates,
} from '@/services/notifications/nativeIncomingCall';
import { reconcileReminders } from '@/services/notifications/reminderService';
import {
  isIosVoipTokenRegistered,
  setIosVoipTokenRegistered,
} from '@/services/notifications/voipRegistrationStore';
import { registerIosVoipToken } from '@/services/notifications/voipTokenService';

/**
 * Keeps the authenticated PushKit token registered across cold start, resume, and native token
 * rotation. Token values are deliberately never logged or copied into React state.
 */
export function useVoipTokenSync(
  isInitializing: boolean,
  isAuthenticated: boolean,
) {
  useEffect(() => {
    if (Platform.OS !== 'ios' || isInitializing) return;

    let disposed = false;
    let operation: Promise<unknown> = Promise.resolve();

    const sync = async (providedToken?: string | null) => {
      const wasRegistered = await isIosVoipTokenRegistered();
      let isRegistered = false;

      if (isAuthenticated) {
        const token =
          providedToken === undefined ? await getVoipToken() : providedToken;
        if (token) {
          isRegistered = await registerIosVoipToken(token);
        } else {
          await setIosVoipTokenRegistered(false);
        }
      } else {
        await setIosVoipTokenRegistered(false);
      }

      // Transitioning either direction changes the desired local trigger set immediately.
      if (!disposed && wasRegistered !== isRegistered) {
        await reconcileReminders('resume', isAuthenticated).catch(() => {});
      }
    };

    const enqueueSync = (token?: string | null) => {
      const next = operation.then(() => sync(token), () => sync(token));
      operation = next.catch(() => undefined);
    };

    enqueueSync();
    const appStateSubscription = AppState.addEventListener('change', next => {
      if (next === 'active') enqueueSync();
    });
    const unsubscribeToken = subscribeToVoipTokenUpdates(token => enqueueSync(token));

    return () => {
      disposed = true;
      appStateSubscription.remove();
      unsubscribeToken();
    };
  }, [isAuthenticated, isInitializing]);
}
