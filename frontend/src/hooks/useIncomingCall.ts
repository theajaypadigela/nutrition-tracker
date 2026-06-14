import { Vibration } from 'react-native';
import notifee from '@notifee/react-native';
import { navigationRef } from '../navigation/navigationRef';
import {
  goBackOrMainTabs,
  navigateToVoiceHabit,
  navigateToVoiceMealLog,
} from '../navigation/navigationUtils';
import { clearMealRescheduleTime } from '../services/mealScheduler';
import { stopRingtone } from './useRingtone';
import {
  onCallAccepted,
  onCallDeclined,
  type OccurrenceData,
} from '../services/notifications/callLifecycle';
import type { ReminderKind } from '../services/notifications/notificationBuilder';

export type IncomingCallType = 'meal' | 'habit';

export type IncomingCallPayload = {
  type: IncomingCallType;
  callId?: string;
  notificationId?: string;
  mealSlotId?: string;
  habitId?: string;
  habitName?: string;
  habitTime?: string;
  // Occurrence metadata carried from the notification data when available.
  intendedFireAt?: number | null;
  slotKey?: string;
  reminderKind?: ReminderKind;
  isRescheduled?: boolean;
};

type HandleCallOptions = {
  skipNavigation?: boolean;
};

let activeCallNotificationId: string | null = null;

export function setActiveCallNotificationId(id: string | null) {
  activeCallNotificationId = id;
}

// ─── In-app call banner callbacks ────────────────────────────────────────────

let callBannerCallback: ((payload: IncomingCallPayload | null) => void) | null = null;

export function registerCallBannerCallback(
  cb: (payload: IncomingCallPayload | null) => void,
) {
  callBannerCallback = cb;
}

export function showCallBanner(payload: IncomingCallPayload) {
  callBannerCallback?.(payload);
}

export function hideCallBanner() {
  callBannerCallback?.(null);
}

function payloadToOccurrence(payload: IncomingCallPayload): OccurrenceData {
  const kind: ReminderKind =
    payload.reminderKind ??
    (payload.type === 'meal' ? 'meal-call' : 'habit-call');
  return {
    kind,
    intendedFireAt: payload.intendedFireAt ?? null,
    slotKey: payload.slotKey,
    habitId: payload.habitId,
    habitName: payload.habitName,
    habitTime: payload.habitTime,
    isRescheduled: payload.isRescheduled ?? false,
  };
}

/**
 * Display-only cancellation (P0 #1 / #2). The previous code called
 * notifee.cancelAllNotifications() / cancelNotification(id), both of which ALSO delete
 * the matching pending trigger — wiping the recurring meal/habit chain on every call
 * interaction. We only ever dismiss what is *currently displayed*; recurring triggers
 * are managed exclusively by the scheduler/reconciliation.
 */
async function dismissDisplayedCall(notificationId?: string) {
  const idToCancel = notificationId ?? activeCallNotificationId;

  if (idToCancel) {
    await notifee.cancelDisplayedNotification(idToCancel).catch(() => {});
  }

  activeCallNotificationId = null;

  // Safety net for sticky displayed call notifications — display-only, never triggers.
  await notifee.cancelDisplayedNotifications().catch(() => {});
}

/**
 * Polls until the navigator is ready, then runs the navigation. No early cap: a pending
 * Accept must survive a slow cold start until navigation is possible (P0 #5).
 */
function navigateWhenReady(runNavigate: () => void) {
  if (navigationRef.isReady()) {
    runNavigate();
    return;
  }
  setTimeout(() => navigateWhenReady(runNavigate), 150);
}

export async function handleAcceptCall(
  payload: IncomingCallPayload,
  options: HandleCallOptions = {},
) {
  hideCallBanner();
  await dismissDisplayedCall(payload.notificationId);
  stopRingtone();
  Vibration.cancel();

  await onCallAccepted(payloadToOccurrence(payload)).catch(() => {});

  if (payload.type === 'meal') {
    await clearMealRescheduleTime().catch(() => {});
  }

  if (options.skipNavigation) {
    return;
  }

  navigateWhenReady(() => {
    if (payload.type === 'habit') {
      navigateToVoiceHabit({
        habitId: payload.habitId,
        habitName: payload.habitName,
        habitTime: payload.habitTime,
        autoStart: true,
      });
      return;
    }

    navigateToVoiceMealLog({
      mealSlotId: payload.mealSlotId,
      autoStart: true,
    });
  });
}

export async function handleDeclineCall(
  payload: IncomingCallPayload,
  options: HandleCallOptions = {},
) {
  hideCallBanner();
  await dismissDisplayedCall(payload.notificationId);
  stopRingtone();
  Vibration.cancel();

  await onCallDeclined(payloadToOccurrence(payload)).catch(() => {});

  if (payload.type === 'meal') {
    await clearMealRescheduleTime().catch(() => {});
  }

  if (options.skipNavigation) {
    return;
  }

  navigateWhenReady(goBackOrMainTabs);
}
