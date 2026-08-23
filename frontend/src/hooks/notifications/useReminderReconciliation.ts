import { useEffect } from 'react';
import { AppState } from 'react-native';
import { reconcileReminders } from '@/services/notifications/reminderService';
import { reminderLog } from '@/services/notifications/logger';

/** Reconciliation: cold start once auth is known, and on every foreground resume. */
export function useReminderReconciliation(
  isInitializing: boolean,
  isAuthenticated: boolean,
) {
  useEffect(() => {
    if (isInitializing) return;
    reconcileReminders('cold-start', isAuthenticated).catch(e =>
      reminderLog.warn('reconcile.cold_start_failed', String(e)),
    );

    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') {
        reconcileReminders('resume', isAuthenticated).catch(e =>
          reminderLog.warn('reconcile.resume_failed', String(e)),
        );
      }
    });
    return () => sub.remove();
  }, [isInitializing, isAuthenticated]);
}
