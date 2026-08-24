import notifee from '@notifee/react-native';
import { navigationRef } from '../navigation/navigationRef';
import {
  goBackOrMainTabs,
  navigateToIncomingCall,
  navigateToVoiceHabit,
  navigateToVoiceMealLog,
} from '../navigation/navigationUtils';
import { clearMealReschedule } from '../services/notifications/reminderService';
import {
  onCallAccepted,
  onCallDeclined,
  type OccurrenceData,
} from '../services/notifications/callLifecycle';
import type { ReminderKind } from '../services/notifications/notificationBuilder';
import { dismissIncomingCall } from '../services/notifications/nativeIncomingCall';

export type IncomingCallType = 'meal' | 'habit';

/**
 * The call descriptor shared between the native call surface (relayed verbatim through the
 * IncomingCall module) and the JS lifecycle. The native side adds display fields
 * (assistantName/subtitle/verifiedLabel) on the way out and relays the occurrence fields back on
 * accept/decline; those occurrence fields are what this app acts on.
 */
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

type HandleCallOptions = { skipNavigation?: boolean };

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
 * Polls until the navigator is ready, then runs the navigation. No early cap: a pending Accept
 * must survive a slow cold start until navigation is possible (a call answered from the lockscreen
 * boots React Native fresh).
 */
function navigateWhenReady(runNavigate: () => void) {
  if (navigationRef.isReady()) {
    runNavigate();
    return;
  }
  setTimeout(() => navigateWhenReady(runNavigate), 150);
}

/** Routes into the voice session for a call payload once the navigator is ready. */
function navigateToVoiceForPayload(payload: IncomingCallPayload): void {
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

/** Shows the React incoming-call fallback without accepting or starting a voice session. */
export function showIncomingCall(payload: IncomingCallPayload): void {
  navigateWhenReady(() => navigateToIncomingCall(payload));
}

/**
 * Runs the lifecycle for an ACCEPTED call and navigates into the voice session. On iOS CallKit
 * remains active for VoIP execution until useVapiSession ends/fails and dismisses it.
 */
export async function handleAcceptCall(
  payload: IncomingCallPayload,
  options: HandleCallOptions = {},
): Promise<void> {
  if (payload.notificationId) {
    await notifee.cancelDisplayedNotification(payload.notificationId).catch(() => {});
  }
  await onCallAccepted(payloadToOccurrence(payload)).catch(() => {});

  if (payload.type === 'meal') {
    await clearMealReschedule().catch(() => {});
  }

  if (!options.skipNavigation) {
    navigateToVoiceForPayload(payload);
  }
}

/** Resolves a fallback notification decline and clears any one-shot meal callback state. */
export async function handleDeclineCall(
  payload: IncomingCallPayload,
  options: HandleCallOptions = {},
): Promise<void> {
  dismissIncomingCall();
  if (payload.notificationId) {
    await notifee.cancelDisplayedNotification(payload.notificationId).catch(() => {});
  }
  await onCallDeclined(payloadToOccurrence(payload)).catch(() => {});
  if (payload.type === 'meal') {
    await clearMealReschedule().catch(() => {});
  }
  if (!options.skipNavigation) {
    navigateWhenReady(goBackOrMainTabs);
  }
}

/**
 * "Log now" on a missed-call follow-up: route into the voice log for that occurrence (same
 * destination as answering would have). The miss was already recorded/reported when detected, so
 * this only navigates.
 */
export async function handleMissedLogNow(payload: IncomingCallPayload): Promise<void> {
  if (payload.type === 'meal') {
    await clearMealReschedule().catch(() => {});
  }
  navigateToVoiceForPayload(payload);
}
