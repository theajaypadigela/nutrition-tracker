import { useCallback, useState } from 'react';
import {
  buildReminderHealthReport,
  HealthItem,
  ReminderHealthReport,
} from '../services/notifications/reminderHealth';

/**
 * Owns the reminder-health report: loading, per-item "fix" busy state, and re-loading after
 * a fix returns. ReminderHealthScreen renders from this and stays presentation-only.
 */
export function useReminderHealth() {
  const [report, setReport] = useState<ReminderHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await buildReminderHealthReport());
    } finally {
      setLoading(false);
    }
  }, []);

  const runFix = useCallback(
    async (item: HealthItem) => {
      if (!item.fix) return;
      setBusyId(item.id);
      try {
        await item.fix.run();
      } finally {
        setBusyId(null);
        // Re-read after returning from settings so the surface reflects the new state.
        load();
      }
    },
    [load],
  );

  return { report, loading, busyId, load, runFix };
}
