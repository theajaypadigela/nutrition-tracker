/**
 * Notifee background (headless) event handler — registered in index.js BEFORE
 * registerComponent and outside the bundle-load try/catch, so a ringing, looping call
 * notification is never orphaned by a JS load failure (§E registration hardening).
 *
 * Deliberately imports no navigation/screen modules: it dismisses displayed
 * notifications, runs the call lifecycle (missed detection, stale suppression, terminal
 * server reporting), and records a pending navigation that App consumes on resume.
 */

import notifee, { EventType } from '@notifee/react-native';
import {
  readOccurrenceData,
  onCallDelivered,
  onCallAccepted,
  onCallDeclined,
} from './callLifecycle';
import { claimAction } from './processedActions';
import {
  setPendingAcceptNavigation,
  PendingAcceptNavigation,
} from '../../navigation/pendingNavigation';
import { reminderLog } from './logger';

async function dismissDisplayed(notificationId?: string): Promise<void> {
  if (notificationId) {
    await notifee.cancelDisplayedNotification(notificationId).catch(() => {});
  }
}

export function registerBackgroundEvent(): void {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    const notification = detail.notification;
    const data = notification?.data as Record<string, any> | undefined;
    const notificationId = notification?.id;
    const occ = readOccurrenceData(data);

    // DELIVERED while killed/background: drive missed detection + stale suppression.
    if (type === EventType.DELIVERED) {
      const { suppress } = await onCallDelivered(occ, notificationId);
      if (suppress) {
        await dismissDisplayed(notificationId);
      }
      return;
    }

    if (type !== EventType.ACTION_PRESS) {
      return;
    }

    const actionId = detail.pressAction?.id;
    if (actionId !== 'accept' && actionId !== 'decline') {
      return;
    }

    // Exactly-once: the same cold-start action may also reach getInitialNotification.
    const claimed = await claimAction(`${notificationId ?? 'unknown'}:${actionId}`);
    if (!claimed) {
      reminderLog.debug('bg.action_deduped', 'Background action already processed', {
        notificationId,
        actionId,
      });
      return;
    }

    await dismissDisplayed(notificationId);

    if (actionId === 'decline') {
      await onCallDeclined(occ);
      return;
    }

    // accept
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
