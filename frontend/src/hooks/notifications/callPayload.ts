import type { OccurrenceData } from '../../services/notifications/callLifecycle';
import type { IncomingCallPayload } from '../useIncomingCall';

/** Builds the call payload the UI/handlers use from a notification's data bag. */
export function payloadFromData(
  data: Record<string, any> | undefined,
  notificationId: string | undefined,
  occ: OccurrenceData,
): IncomingCallPayload {
  if (occ.kind === 'meal-call') {
    return {
      type: 'meal',
      notificationId,
      mealSlotId: (data?.mealSlotId as string | undefined) || 'daily',
      reminderKind: 'meal-call',
      intendedFireAt: occ.intendedFireAt,
      slotKey: occ.slotKey,
      isRescheduled: occ.isRescheduled,
    };
  }
  return {
    type: 'habit',
    notificationId,
    habitId: occ.habitId,
    habitName: occ.habitName,
    habitTime: occ.habitTime,
    reminderKind: occ.kind,
    intendedFireAt: occ.intendedFireAt,
    slotKey: occ.slotKey,
    isRescheduled: occ.isRescheduled,
  };
}
