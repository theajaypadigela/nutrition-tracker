import { useEffect } from 'react';
import { AppState } from 'react-native';
import {
  consumePendingAnswer,
  consumePendingMissedAction,
} from '../../services/notifications/nativeIncomingCall';
import { handleAcceptCall, handleMissedLogNow } from '../useIncomingCall';

/**
 * Consumes results the native call surface persisted while the app was killed/backgrounded, and
 * routes the user. Runs on mount (cold start, e.g. answered from the lockscreen) and on every
 * foreground resume:
 *  - an ACCEPTED call → navigate into the voice session;
 *  - a "Log now"/tapped MISSED-call follow-up → navigate into the voice log for that occurrence.
 * Declines/native-misses are reconciled separately in the reconciliation pass
 * (callMarkers.applyCallResultMarkers).
 */
export function useNativeIncomingCallResults() {
  useEffect(() => {
    const consume = async () => {
      const answered = await consumePendingAnswer();
      if (answered) {
        // handleAcceptCall runs the lifecycle (onCallAccepted) and navigates once ready.
        handleAcceptCall(answered).catch(() => {});
      }
      const missedLog = await consumePendingMissedAction();
      if (missedLog) {
        handleMissedLogNow(missedLog).catch(() => {});
      }
    };

    consume();
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') consume();
    });
    return () => subscription.remove();
  }, []);
}
