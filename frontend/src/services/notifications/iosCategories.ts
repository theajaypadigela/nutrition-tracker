/**
 * iOS notification categories (§G). The payloads reference categoryId 'meal-call' /
 * 'habit-call' but the categories were never registered, so Accept/Decline buttons never
 * appeared on iOS. Registering them here wires the action buttons. A background action
 * press launches the app in the background and delivers the event to JS, where we sync
 * server state immediately.
 *
 * iOS-only; a no-op elsewhere.
 */

import notifee, { IOSNotificationCategory } from '@notifee/react-native';
import { Platform } from 'react-native';
import { reminderLog } from './logger';

const CALL_ACTIONS = [
  { id: 'accept', title: 'Accept', foreground: true },
  { id: 'decline', title: 'Decline', destructive: true },
];

export async function registerIosCategories(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }
  const categories: IOSNotificationCategory[] = [
    { id: 'meal-call', actions: CALL_ACTIONS },
    { id: 'habit-call', actions: CALL_ACTIONS },
  ];
  try {
    await notifee.setNotificationCategories(categories);
  } catch (e) {
    reminderLog.warn('ios.categories_failed', 'Failed to register iOS categories', {
      error: String(e),
    });
  }
}
