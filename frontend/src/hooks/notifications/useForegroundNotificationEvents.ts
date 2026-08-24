import { useEffect } from 'react';
import { Platform } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import {
  readOccurrenceData,
  onCallDelivered,
} from '@/services/notifications/callLifecycle';
import { presentIncomingCall } from '@/services/notifications/nativeIncomingCall';
import { claimAction } from '@/services/notifications/processedActions';
import {
  iosCallInteractionKey,
  readIosCallInteraction,
} from '@/services/notifications/iosCallInteraction';
import {
  handleAcceptCall,
  handleDeclineCall,
  showIncomingCall,
} from '../useIncomingCall';
import { payloadFromData } from './callPayload';

/**
 * Foreground Notifee events for calls.
 *  - Android: on DELIVERED, classify staleness + record the pending-answer marker, dismiss the
 *    silent heartbeat, and ring the NATIVE full-screen call (a real takeover even with the app
 *    open). Accept/Decline happen natively, so there are no Notifee actions to handle here.
 *  - iOS: a foreground local trigger is promoted to CallKit when the native module is available;
 *    the standard notification remains as fallback otherwise.
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
            if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

            if (suppress) {
              if (notificationId) {
                notifee.cancelDisplayedNotification(notificationId).catch(() => {});
              }
              return;
            }

            const presented = presentIncomingCall(
              payloadFromData(data, notificationId, occ),
            );
            // Android's notification is a silent alarm carrier. On iOS cancel the duplicate
            // standard banner only after CallKit was successfully requested.
            if ((Platform.OS === 'android' || presented) && notificationId) {
              notifee.cancelDisplayedNotification(notificationId).catch(() => {});
            }
          })
          .catch(() => {});
        return;
      }

      if (Platform.OS !== 'ios') return;

      // A body tap opens the fallback call UI; only the explicit Accept action starts voice.
      const interaction = readIosCallInteraction(type, detail.pressAction?.id);
      if (!interaction) return;

      // A cold-start interaction can also be surfaced through getInitialNotification.
      // Claim before acting so only one path can navigate/start Vapi.
      claimAction(iosCallInteractionKey(notificationId, interaction))
        .then(claimed => {
          if (!claimed) return;
          const payload = payloadFromData(data, notificationId, occ);
          if (interaction === 'open') {
            showIncomingCall(payload);
            return;
          }
          if (interaction === 'accept') {
            return handleAcceptCall(payload);
          }
          return handleDeclineCall(payload, { skipNavigation: true });
        })
        .catch(() => {});
    });
  }, []);
}
