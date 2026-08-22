import notifee, {
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';
import { NOTIFICATION_CHANNEL_IDS } from '../app/notifications/contracts';

export async function setupNotifeeChannels() {
  // Channel for meal logging call notifications (full-screen call style)
  await notifee.createChannel({
    id: NOTIFICATION_CHANNEL_IDS.mealCall,
    name: 'Meal Logging Calls',
    description: 'Full-screen incoming call notifications for meal logging',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    bypassDnd: true,
    vibration: true,
    sound: 'default',
    lights: true,
    lightColor: '#10b981',
  });

  // Channel for habit voice call notifications
  await notifee.createChannel({
    id: NOTIFICATION_CHANNEL_IDS.habitCall,
    name: 'Habit Voice Reminders',
    description: 'Full-screen incoming call notifications for habit reminders',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    bypassDnd: true,
    vibration: true,
    sound: 'default',
    lights: true,
    lightColor: '#10b981',
  });

  // Channel for regular habit push notifications
  await notifee.createChannel({
    id: NOTIFICATION_CHANNEL_IDS.habitPush,
    name: 'Habit Push Reminders',
    description: 'Standard push notifications for habit reminders',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    vibration: true,
    sound: 'default',
  });
}
