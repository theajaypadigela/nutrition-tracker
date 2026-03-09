import notifee, {
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';

export async function setupNotifeeChannels() {
  // Channel for meal logging call notifications (full-screen call style)
  await notifee.createChannel({
    id: 'meal-call-v2',
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
    id: 'habit-call-v1',
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
    id: 'habit-push-v1',
    name: 'Habit Push Reminders',
    description: 'Standard push notifications for habit reminders',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    vibration: true,
    sound: 'default',
  });
}
