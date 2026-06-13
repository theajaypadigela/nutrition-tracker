/**
 * Aggregates the reminder-health surface (§H): one row per dependency with a status and
 * a one-tap fix. Also the place degraded modes ("reminders may be inexact") are explained.
 */

import { Platform } from 'react-native';
import {
  readPermissionSnapshot,
  openNotificationSettings,
  openAlarmPermissionSettings,
  openBatteryOptimizationSettings,
  openPowerManagerSettings,
} from './permissions';
import { inspectCallChannels } from './channels';

export type HealthStatus = 'ok' | 'warn' | 'error' | 'na';

export type HealthItem = {
  id: string;
  title: string;
  status: HealthStatus;
  detail: string;
  /** A one-tap fix, when one exists. */
  fix?: { label: string; run: () => Promise<void> };
};

export type ReminderHealthReport = {
  items: HealthItem[];
  /** True if any reminder will fire late or not at all. Drives a banner on the surface. */
  degraded: boolean;
};

export async function buildReminderHealthReport(): Promise<ReminderHealthReport> {
  const snapshot = await readPermissionSnapshot();
  const channels = await inspectCallChannels();
  const items: HealthItem[] = [];

  // Notifications
  items.push({
    id: 'notifications',
    title: 'Notifications',
    status: snapshot.notificationsAuthorized
      ? snapshot.provisional
        ? 'warn'
        : 'ok'
      : 'error',
    detail: snapshot.notificationsAuthorized
      ? snapshot.provisional
        ? 'Provisional (quiet) authorization — calls may not ring loudly.'
        : 'Reminders can be delivered.'
      : 'Reminders are OFF. Calls cannot be delivered until you enable notifications.',
    fix: snapshot.notificationsAuthorized
      ? undefined
      : { label: 'Open settings', run: openNotificationSettings },
  });

  // Exact alarms (Android only)
  if (Platform.OS === 'android') {
    if (snapshot.exactAlarm === 'denied') {
      items.push({
        id: 'exact-alarm',
        title: 'Exact alarms',
        status: 'warn',
        detail: 'Not granted — reminders may be a few minutes late.',
        fix: { label: 'Allow exact alarms', run: openAlarmPermissionSettings },
      });
    } else {
      items.push({
        id: 'exact-alarm',
        title: 'Exact alarms',
        status: 'ok',
        detail:
          snapshot.exactAlarm === 'granted'
            ? 'Granted — reminders fire on time.'
            : 'Not required on this Android version.',
      });
    }

    // Battery optimization
    items.push({
      id: 'battery',
      title: 'Battery optimization',
      status: snapshot.batteryOptimizationEnabled ? 'warn' : 'ok',
      detail: snapshot.batteryOptimizationEnabled
        ? 'On — the system may delay or drop reminders. Exempt this app for reliable delivery.'
        : 'Off for this app — good for reliability.',
      fix: snapshot.batteryOptimizationEnabled
        ? { label: 'Fix', run: openBatteryOptimizationSettings }
        : undefined,
    });

    // OEM autostart / power manager (MIUI, Samsung, OnePlus, Huawei, …)
    if (snapshot.oemPowerManagerAvailable) {
      items.push({
        id: 'oem-autostart',
        title: 'Manufacturer autostart',
        status: 'warn',
        detail:
          'Your device has aggressive app-killing. Enable autostart / disable sleeping for this app so reminders survive.',
        fix: { label: 'Open device settings', run: openPowerManagerSettings },
      });
    }

    // Channel health
    const degradedChannels = channels.filter(c => !c.exists || c.blocked || c.loweredImportance);
    if (degradedChannels.length > 0) {
      const blocked = degradedChannels.some(c => c.blocked || !c.exists);
      items.push({
        id: 'channels',
        title: 'Notification categories',
        status: blocked ? 'error' : 'warn',
        detail: blocked
          ? 'A reminder category is blocked. Calls in that category will not appear.'
          : 'A reminder category was lowered — calls may not ring or pop up.',
        fix: { label: 'Open settings', run: openNotificationSettings },
      });
    } else {
      items.push({
        id: 'channels',
        title: 'Notification categories',
        status: 'ok',
        detail: 'All reminder categories are healthy.',
      });
    }
  } else {
    // iOS
    items.push({
      id: 'exact-alarm',
      title: 'Exact alarms',
      status: 'na',
      detail: 'Not applicable on iOS — the system schedules notifications.',
    });
  }

  const degraded = items.some(i => i.status === 'error' || i.status === 'warn');
  return { items, degraded };
}
