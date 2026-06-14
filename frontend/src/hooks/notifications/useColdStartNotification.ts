import { useEffect } from 'react';
import notifee from '@notifee/react-native';
import { navigationRef } from '../../navigation/navigationRef';
import { ROUTES } from '../../navigation/routeNames';
import { resetToIncomingCall } from '../../navigation/navigationUtils';
import { readOccurrenceData } from '../../services/notifications/callLifecycle';
import { claimAction } from '../../services/notifications/processedActions';
import {
  handleAcceptCall,
  handleDeclineCall,
  setActiveCallNotificationId,
} from '../useIncomingCall';
import { payloadFromData } from './callPayload';

/** Cold-start tap recovery. Deduped against the background handler (P0 #5). */
export function useColdStartNotification() {
  useEffect(() => {
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
}
