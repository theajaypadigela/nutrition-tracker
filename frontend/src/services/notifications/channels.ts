/**
 * Notification channel definitions, creation, and health detection (§C channel health).
 *
 * Channel settings are immutable after creation on Android, so when we need different
 * settings we bump the channel id version (the existing `meal-call-v2` pattern). This
 * module is the single source of channel ids; schedulers import these constants rather
 * than hard-coding strings, so a version bump is one edit here.
 */

import notifee, {
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { reminderLog } from './logger';

// Bumped from meal-call-v2 / habit-call-v1: these channels now carry call semantics we
// want consistent (importance HIGH, bypassDnd best-effort, looping call vibration).
export const MEAL_CALL_CHANNEL_ID = 'meal-call-v3';
export const HABIT_CALL_CHANNEL_ID = 'habit-call-v2';
export const HABIT_PUSH_CHANNEL_ID = 'habit-push-v2';

/** Quiet channel for late/missed reminder follow-ups — no full-screen, no loop. */
export const MISSED_CHANNEL_ID = 'reminder-missed-v1';

type ChannelDef = {
  id: string;
  name: string;
  description: string;
  call: boolean;
};

export const CHANNEL_DEFS: ChannelDef[] = [
  {
    id: MEAL_CALL_CHANNEL_ID,
    name: 'Meal Logging Calls',
    description: 'Full-screen incoming call notifications for meal logging',
    call: true,
  },
  {
    id: HABIT_CALL_CHANNEL_ID,
    name: 'Habit Voice Reminders',
    description: 'Full-screen incoming call notifications for habit reminders',
    call: true,
  },
  {
    id: HABIT_PUSH_CHANNEL_ID,
    name: 'Habit Push Reminders',
    description: 'Standard push notifications for habit reminders',
    call: false,
  },
  {
    id: MISSED_CHANNEL_ID,
    name: 'Missed Reminders',
    description: 'Quiet follow-ups when a reminder was missed or arrived late',
    call: false,
  },
];

export const CALL_CHANNEL_IDS = CHANNEL_DEFS.filter(c => c.call).map(c => c.id);

// Superseded channel ids from earlier versions. Deleted on startup so upgrading users
// don't accumulate duplicate "Meal Logging Calls" entries in system settings.
const DEPRECATED_CHANNEL_IDS = ['meal-call-v2', 'habit-call-v1', 'habit-push-v1'];

export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  for (const oldId of DEPRECATED_CHANNEL_IDS) {
    await notifee.deleteChannel(oldId).catch(() => {});
  }
  for (const def of CHANNEL_DEFS) {
    await notifee.createChannel({
      id: def.id,
      name: def.name,
      description: def.description,
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      // DND honesty (§C): bypassDnd requires user-granted DND access
      // (ACCESS_NOTIFICATION_POLICY), which Notifee can't request and we don't, so it was
      // a no-op for ~all users. We set it false rather than claim a bypass we don't have.
      // The real Doze/DND resilience for call reminders comes from the SET_ALARM_CLOCK
      // alarm type (notificationBuilder), which is honored as an alarm even in DND when the
      // user permits alarms — the common default.
      bypassDnd: false,
      vibration: true,
      sound: def.id === MISSED_CHANNEL_ID ? undefined : 'default',
      lights: true,
      lightColor: '#10b981',
    });
  }
}

export type ChannelHealth = {
  id: string;
  exists: boolean;
  blocked: boolean;
  /** Lowered below HIGH by the user; reduces heads-up / sound behaviour. */
  loweredImportance: boolean;
};

/**
 * Inspects the call channels users most rely on. Users can mute, lower, or delete a
 * channel; because channel settings are immutable we can only detect and prompt.
 */
export async function inspectCallChannels(): Promise<ChannelHealth[]> {
  if (Platform.OS !== 'android') {
    return [];
  }
  const out: ChannelHealth[] = [];
  for (const id of CALL_CHANNEL_IDS) {
    try {
      const channel = await notifee.getChannel(id);
      if (!channel) {
        out.push({ id, exists: false, blocked: false, loweredImportance: false });
        continue;
      }
      const importance = channel.importance ?? AndroidImportance.HIGH;
      const health: ChannelHealth = {
        id,
        exists: true,
        blocked: channel.blocked === true,
        loweredImportance: importance < AndroidImportance.HIGH,
      };
      if (health.blocked || health.loweredImportance) {
        reminderLog.warn(
          'channel.degraded',
          `Channel ${id} is degraded`,
          { blocked: health.blocked, importance },
        );
      }
      out.push(health);
    } catch (e) {
      out.push({ id, exists: false, blocked: false, loweredImportance: false });
      reminderLog.warn('channel.inspect_failed', `Could not inspect ${id}`, {
        error: String(e),
      });
    }
  }
  return out;
}
