/**
 * Notifee background (headless) event handler — registered in index.js BEFORE registerComponent
 * and outside the bundle-load try/catch, so a ringing call is never orphaned by a JS load failure.
 *
 * Android local delivery: a call reminder fires a SILENT heartbeat notification. On its
 * DELIVERED event (which Notifee runs in a headless JS task even when the app is killed) we run
 * the call lifecycle (staleness suppression + the pending-answer marker), cancel the heartbeat,
 * and ask the NATIVE incoming-call surface to ring — which draws the full-screen call over the
 * lockscreen with no React rendering on the critical path.
 *
 * iOS local notifications remain the fallback when PushKit/CallKit is not registered. This
 * handler persists body-tap/Accept navigation so a separate UI process can consume it safely.
 */

import notifee, { EventType } from '@notifee/react-native';
import { Platform } from 'react-native';
import {
  readOccurrenceData,
  onCallDelivered,
} from './callLifecycle';
import { presentIncomingCall } from './nativeIncomingCall';
import { payloadFromData } from '@/hooks/notifications/callPayload';
import { claimAction } from './processedActions';
import {
  iosCallInteractionKey,
  readIosCallInteraction,
} from './iosCallInteraction';
import {
  setPendingAcceptNavigation,
  type PendingAcceptNavigation,
} from '@/navigation/pendingNavigation';
import { ROUTES } from '@/navigation/routeNames';
import { reminderLog } from './logger';
import { handleAcceptCall, handleDeclineCall } from '@/hooks/useIncomingCall';

export function registerBackgroundEvent(): void {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    const notification = detail.notification;
    const data = notification?.data as Record<string, any> | undefined;
    const notificationId = notification?.id;
    const occ = readOccurrenceData(data);
    const isCall = occ.kind === 'meal-call' || occ.kind === 'habit-call';
    if (!isCall) return;

    if (type === EventType.DELIVERED) {
      const { suppress } = await onCallDelivered(occ, notificationId);
      if (Platform.OS === 'android') {
        // The heartbeat is only an alarm carrier — dismiss it and ring the native call screen.
        if (notificationId) {
          await notifee.cancelDisplayedNotification(notificationId).catch(() => {});
        }
        if (!suppress) {
          presentIncomingCall(payloadFromData(data, notificationId, occ));
        }
      }
      return;
    }

    // From here: iOS interactions only (Android calls use native buttons, so the
    // heartbeat carries no Notifee actions and never reaches this branch).
    if (Platform.OS !== 'ios') return;
    const interaction = readIosCallInteraction(type, detail.pressAction?.id);
    if (!interaction) return;

    // Exactly-once: iOS can surface the same launch interaction again to the
    // foreground listener or legacy getInitialNotification fallback.
    const claimed = await claimAction(
      iosCallInteractionKey(notificationId, interaction),
    );
    if (!claimed) {
      reminderLog.debug('bg.action_deduped', 'Background action already processed', {
        notificationId,
        actionId: interaction,
      });
      return;
    }

    if (interaction === 'decline') {
      await handleDeclineCall(payloadFromData(data, notificationId, occ), {
        skipNavigation: true,
      });
      return;
    }

    const payload = payloadFromData(data, notificationId, occ);
    if (interaction === 'open') {
      await setPendingAcceptNavigation({
        screen: ROUTES.INCOMING_CALL,
        payload,
      });
      return;
    }

    await handleAcceptCall(payload, { skipNavigation: true });
    const pending: PendingAcceptNavigation =
      occ.kind === 'meal-call'
        ? { screen: 'VoiceMealLog', mealSlotId: data?.mealSlotId ?? 'daily' }
        : {
            screen: 'VoiceHabit',
            habitId: occ.habitId,
            habitName: occ.habitName,
            habitTime: occ.habitTime,
          };
    await setPendingAcceptNavigation(pending);
  });
}
