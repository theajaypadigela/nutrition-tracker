import { useEffect } from 'react';
import { Platform } from 'react-native';
import notifee from '@notifee/react-native';
import {
  readOccurrenceData,
} from '@/services/notifications/callLifecycle';
import { claimAction } from '@/services/notifications/processedActions';
import {
  iosCallInteractionKey,
  readInitialIosCallInteraction,
} from '@/services/notifications/iosCallInteraction';
import {
  handleAcceptCall,
  handleDeclineCall,
  showIncomingCall,
} from '../useIncomingCall';
import { payloadFromData } from './callPayload';

/**
 * Legacy iOS cold-start fallback for a call notification interaction while the app was
 * killed. Modern Notifee versions also emit the interaction to onForegroundEvent, so every
 * path shares the same exactly-once claim. (Android accepts/declines natively and is picked
 * up by useNativeIncomingCallResults.)
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

      const interaction = readInitialIosCallInteraction(
        initialNotification.pressAction?.id,
      );
      if (!interaction) return;

      const claimed = await claimAction(
        iosCallInteractionKey(notificationId, interaction),
      );
      if (!claimed) return; // background handler already processed this action

      const payload = payloadFromData(data, notificationId, occ);
      if (interaction === 'open') {
        showIncomingCall(payload);
      } else if (interaction === 'accept') {
        handleAcceptCall(payload).catch(() => {});
      } else {
        handleDeclineCall(payload, { skipNavigation: true }).catch(() => {});
      }
    });
  }, []);
}
