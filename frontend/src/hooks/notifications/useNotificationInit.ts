import { useEffect } from 'react';
import { initReminders } from '../../services/notifications/reminderService';
import { reminderLog } from '../../services/notifications/logger';

/** One-time startup: create channels + register iOS action categories. */
export function useNotificationInit() {
  useEffect(() => {
    initReminders().catch(e => reminderLog.warn('init.failed', String(e)));
  }, []);
}
