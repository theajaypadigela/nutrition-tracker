/**
 * Notifee background (headless) event handler — registered in index.js BEFORE registerComponent
 * and outside the bundle-load try/catch, so a ringing call is never orphaned by a JS load failure.
 *
 * Android (the true-call platform): a call reminder fires a SILENT heartbeat notification. On its
 * DELIVERED event (which Notifee runs in a headless JS task even when the app is killed) we run
 * the call lifecycle (staleness suppression + the pending-answer marker), cancel the heartbeat,
 * and ask the NATIVE incoming-call surface to ring — which draws the full-screen call over the
 * lockscreen with no React rendering on the critical path.
 *
 * iOS (true-call out of scope): calls are plain time-sensitive notifications; we handle their
 * Accept/Decline actions here exactly as before (record terminal status, record a pending Accept
 * navigation the app consumes on resume).
 */

import notifee, { EventType } from '@notifee/react-native';
import { Platform } from 'react-native';
import {
  readOccurrenceData,
  onCallDelivered,
  onCallAccepted,
  onCallDeclined,
} from './callLifecycle';
import { presentIncomingCall } from './nativeIncomingCall';
import { payloadFromData } from '@/hooks/notifications/callPayload';
import { claimAction } from './processedActions';
import {
  setPendingAcceptNavigation,
  PendingAcceptNavigation,
} from '@/navigation/pendingNavigation';
import { reminderLog } from './logger';

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

    // From here: iOS notification actions only (Android calls use native buttons, so the
    // heartbeat carries no Notifee actions and never reaches this branch).
    if (type !== EventType.ACTION_PRESS) return;
    const actionId = detail.pressAction?.id;
    if (actionId !== 'accept' && actionId !== 'decline') return;

    // Exactly-once: the same cold-start action may also reach getInitialNotification.
    const claimed = await claimAction(`${notificationId ?? 'unknown'}:${actionId}`);
    if (!claimed) {
      reminderLog.debug('bg.action_deduped', 'Background action already processed', {
        notificationId,
        actionId,
      });
      return;
    }

    if (actionId === 'decline') {
      await onCallDeclined(occ);
      return;
    }

    await onCallAccepted(occ);
    const pending: PendingAcceptNavigation =
      occ.kind === 'meal-call'
        ? { screen: 'VoiceMealLog', mealSlotId: data?.mealSlotId ?? 'daily' }
        : {
            screen: 'VoiceHabit',
            habitId: occ.habitId,
            habitName: occ.habitName,
            habitTime: occ.habitTime,
          };
    setPendingAcceptNavigation(pending);
  });
}
