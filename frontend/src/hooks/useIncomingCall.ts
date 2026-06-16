import { navigationRef } from '../navigation/navigationRef';
import {
  navigateToVoiceHabit,
  navigateToVoiceMealLog,
} from '../navigation/navigationUtils';
import { clearMealRescheduleTime } from '../services/mealScheduler';
import { onCallAccepted, type OccurrenceData } from '../services/notifications/callLifecycle';
import type { ReminderKind } from '../services/notifications/notificationBuilder';

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

/**
 * Runs the lifecycle for an ACCEPTED call and navigates into the voice session. The native call
 * screen already stopped the ringtone and dismissed the call notification before handing the
 * accepted payload back, so this only resolves the pending-answer marker and routes the user.
 */
export async function handleAcceptCall(payload: IncomingCallPayload): Promise<void> {
  await onCallAccepted(payloadToOccurrence(payload)).catch(() => {});

  if (payload.type === 'meal') {
    await clearMealRescheduleTime().catch(() => {});
  }

  navigateToVoiceForPayload(payload);
}

/**
 * "Log now" on a missed-call follow-up: route into the voice log for that occurrence (same
 * destination as answering would have). The miss was already recorded/reported when detected, so
 * this only navigates.
 */
export async function handleMissedLogNow(payload: IncomingCallPayload): Promise<void> {
  if (payload.type === 'meal') {
    await clearMealRescheduleTime().catch(() => {});
  }
  navigateToVoiceForPayload(payload);
}
