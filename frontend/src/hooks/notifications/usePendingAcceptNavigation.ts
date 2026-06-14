import { useEffect } from 'react';
import { AppState } from 'react-native';
import { navigationRef } from '../../navigation/navigationRef';
import {
  navigateToVoiceHabit,
  navigateToVoiceMealLog,
} from '../../navigation/navigationUtils';
import { takePendingAcceptNavigation } from '../../navigation/pendingNavigation';

/** Consume a pending Accept navigation recorded by the background handler on resume. */
export function usePendingAcceptNavigation() {
  useEffect(() => {
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
}
