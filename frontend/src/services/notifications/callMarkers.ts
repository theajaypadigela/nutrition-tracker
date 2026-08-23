/**
 * Drains the terminal call markers the native incoming-call surface persisted while the app was
 * backgrounded/killed and feeds them into the call lifecycle:
 *  - DECLINED → report the terminal status to the server and resolve the pending-answer marker.
 *  - MISSED (rang out 60s) → record the miss + report it; the native foreground service already
 *    showed the missed-call follow-up, so this only reconciles state (and marks the follow-up
 *    shown so reconciliation doesn't post a duplicate).
 *
 * Invoked at the START of the reconciliation pass, BEFORE the pending-answer "missed" sweep
 * (reconcileExpiredAnswers), so a decline/native-miss is never misclassified or double-counted.
 */

import {
  onCallDeclined,
  onCallMissed,
  type OccurrenceData,
} from './callLifecycle';
import type { ReminderKind } from './notificationBuilder';
import { drainCallResults } from './nativeIncomingCall';
import { reminderLog } from './logger';
import type { IncomingCallPayload } from '@/hooks/useIncomingCall';

function payloadToOccurrence(p: IncomingCallPayload): OccurrenceData {
  const kind: ReminderKind =
    p.reminderKind ?? (p.type === 'meal' ? 'meal-call' : 'habit-call');
  return {
    kind,
    intendedFireAt: p.intendedFireAt ?? null,
    slotKey: p.slotKey,
    habitId: p.habitId,
    habitName: p.habitName,
    habitTime: p.habitTime,
    isRescheduled: p.isRescheduled ?? false,
  };
}

/** Applies natively-recorded declined/missed call markers. Returns the count handled. */
export async function applyCallResultMarkers(): Promise<number> {
  const markers = await drainCallResults();
  let count = 0;
  for (const { payload, result } of markers) {
    const occ = payloadToOccurrence(payload);
    if (result === 'declined') {
      await onCallDeclined(occ).catch(() => {});
    } else {
      await onCallMissed(occ).catch(() => {});
    }
    count++;
  }
  if (count > 0) {
    reminderLog.info('call.markers_drained', `Applied ${count} native call marker(s)`);
  }
  return count;
}
