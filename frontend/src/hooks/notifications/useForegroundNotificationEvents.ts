import { useEffect } from 'react';
import notifee, { EventType } from '@notifee/react-native';
import { ROUTES } from '../../navigation/routeNames';
import { navigateToIncomingCall } from '../../navigation/navigationUtils';
import {
  readOccurrenceData,
  onCallDelivered,
} from '../../services/notifications/callLifecycle';
import {
  handleAcceptCall,
  handleDeclineCall,
  setActiveCallNotificationId,
  showCallBanner,
} from '../useIncomingCall';
import { payloadFromData } from './callPayload';

/** Foreground notifee events: delivered (in-app banner), press (navigate), action-press. */
export function useForegroundNotificationEvents() {
  useEffect(() => {
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
}
