import { useEffect } from 'react';
import { Platform } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import {
  readOccurrenceData,
  onCallDelivered,
  onCallDeclined,
} from '@/services/notifications/callLifecycle';
import { presentIncomingCall } from '@/services/notifications/nativeIncomingCall';
import { handleAcceptCall } from '../useIncomingCall';
import { payloadFromData } from './callPayload';

/**
 * Foreground Notifee events for calls.
 *  - Android: on DELIVERED, classify staleness + record the pending-answer marker, dismiss the
 *    silent heartbeat, and ring the NATIVE full-screen call (a real takeover even with the app
 *    open). Accept/Decline happen natively, so there are no Notifee actions to handle here.
 *  - iOS (true-call out of scope): the OS presents the call notification; we handle its
 *    Accept/Decline actions.
 */
export function useForegroundNotificationEvents() {
  useEffect(() => {
    return notifee.onForegroundEvent(({ type, detail }) => {
      const data = detail.notification?.data as Record<string, any> | undefined;
      const notificationId = detail.notification?.id;
      const occ = readOccurrenceData(data);

      const isCall = occ.kind === 'meal-call' || occ.kind === 'habit-call';
      if (!isCall) return;

      if (type === EventType.DELIVERED) {
        onCallDelivered(occ, notificationId)
          .then(({ suppress }) => {
            if (Platform.OS !== 'android') return;
            if (notificationId) {
              notifee.cancelDisplayedNotification(notificationId).catch(() => {});
            }
            if (suppress) return;
            presentIncomingCall(payloadFromData(data, notificationId, occ));
          })
          .catch(() => {});
        return;
      }

      // iOS notification actions.
      if (type === EventType.ACTION_PRESS) {
        if (detail.pressAction?.id === 'accept') {
          handleAcceptCall(payloadFromData(data, notificationId, occ)).catch(() => {});
        } else if (detail.pressAction?.id === 'decline') {
          onCallDeclined(occ).catch(() => {});
        }
      }
    });
  }, []);
}
