/**
 * Reports a terminal occurrence status for habit calls so the server never leaves a
 * habit eternally PENDING (§E/§F). For a consolidated call slot we don't carry a single
 * habitId, so we send the reminder time and the server resolves every matching habit.
 */

import apiClient from '../../api/client';
import { reminderLog } from './logger';
import { resolveDeviceTimeZone } from './time';

export type OccurrenceStatus = 'MISSED' | 'DECLINED';

export async function reportHabitOccurrence(input: {
  habitId?: string;
  reminderTime?: string;
  status: OccurrenceStatus;
}): Promise<void> {
  if (!input.habitId && !input.reminderTime) {
    return;
  }
  try {
    await apiClient.post('/habit/occurrence-status', {
      habitId: input.habitId,
      reminderTime: input.reminderTime,
      status: input.status,
      timezone: resolveDeviceTimeZone(),
    });
    reminderLog.info('habit.occurrence_reported', 'Reported habit occurrence status', {
      status: input.status,
      habitId: input.habitId,
      reminderTime: input.reminderTime,
    });
  } catch (e: any) {
    reminderLog.warn('habit.occurrence_report_failed', 'Failed to report habit occurrence', {
      status: input.status,
      error: String(e?.message ?? e),
    });
  }
}
