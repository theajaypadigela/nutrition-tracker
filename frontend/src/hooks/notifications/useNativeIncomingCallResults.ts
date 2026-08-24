import { useEffect } from 'react';
import { AppState } from 'react-native';
import {
  consumePendingAnswer,
  consumePendingMissedAction,
  nativeCallActionKey,
  subscribeToNativeIncomingCallEvents,
} from '@/services/notifications/nativeIncomingCall';
import { applyCallResultMarkers } from '@/services/notifications/callMarkers';
import { claimAction } from '@/services/notifications/processedActions';
import { handleAcceptCall, handleMissedLogNow } from '../useIncomingCall';

/**
 * Consumes results the native call surface persisted while the app was killed/backgrounded, and
 * routes the user. Runs on mount (cold start, e.g. answered from the lockscreen) and on every
 * foreground resume:
 *  - an ACCEPTED call → navigate into the voice session;
 *  - a "Log now"/tapped MISSED-call follow-up → navigate into the voice log for that occurrence.
 * Live iOS events trigger the same authoritative consume/drain path immediately. The persisted
 * native stores remain the source of truth, so an event racing AppState or arriving before React
 * mounts can never start the session twice or lose a terminal result.
 */
export function useNativeIncomingCallResults() {
  useEffect(() => {
    let operation: Promise<unknown> = Promise.resolve();

    const consume = async () => {
      const answered = await consumePendingAnswer();
      if (answered) {
        const claimed = await claimAction(nativeCallActionKey(answered, 'accept'));
        if (claimed) {
          // handleAcceptCall runs the lifecycle and routes with autoStart exactly once.
          await handleAcceptCall(answered).catch(() => {});
        }
      }
      const missedLog = await consumePendingMissedAction();
      if (missedLog) {
        await handleMissedLogNow(missedLog).catch(() => {});
      }
      await applyCallResultMarkers().catch(() => 0);
    };

    const enqueueConsume = () => {
      const next = operation.then(consume, consume);
      operation = next.catch(() => undefined);
    };

    enqueueConsume();
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') enqueueConsume();
    });
    const unsubscribeNative = subscribeToNativeIncomingCallEvents(event => {
      if (
        event.result === 'answered' ||
        event.result === 'declined' ||
        event.result === 'missed'
      ) {
        enqueueConsume();
      }
    });
    return () => {
      subscription.remove();
      unsubscribeNative();
    };
  }, []);
}
