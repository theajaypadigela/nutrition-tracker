import { useEffect } from 'react';
import { Platform } from 'react-native';
import notifee from '@notifee/react-native';
import {
  readOccurrenceData,
  onCallDeclined,
} from '../../services/notifications/callLifecycle';
import { claimAction } from '../../services/notifications/processedActions';
import { handleAcceptCall } from '../useIncomingCall';
import { payloadFromData } from './callPayload';

/**
 * iOS-only cold-start recovery for a call notification's Accept/Decline action tapped while the
 * app was killed. (On Android the call is accepted/declined natively and the accepted payload is
 * picked up by useNativeIncomingCallResults — Notifee's getInitialNotification is not involved.)
 * Deduped against the background handler.
 */
export function useColdStartNotification() {
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    notifee.getInitialNotification().then(async initialNotification => {
      if (!initialNotification) return;
      const data = initialNotification.notification?.data as
        | Record<string, any>
        | undefined;
      const notificationId = initialNotification.notification?.id;
      const occ = readOccurrenceData(data);

      const isCall = occ.kind === 'meal-call' || occ.kind === 'habit-call';
      if (!isCall) return;

      const actionId = initialNotification.pressAction?.id;
      if (actionId !== 'accept' && actionId !== 'decline') return;

      const claimed = await claimAction(`${notificationId ?? 'unknown'}:${actionId}`);
      if (!claimed) return; // background handler already processed this action

      if (actionId === 'accept') {
        handleAcceptCall(payloadFromData(data, notificationId, occ)).catch(() => {});
      } else {
        onCallDeclined(occ).catch(() => {});
      }
    });
  }, []);
}
