/**
 * Notification channel definitions, creation, and health detection (§C channel health).
 *
 * Channel settings are immutable after creation on Android, so when we need different
 * settings we bump the channel id version. This module is the single source of channel ids;
 * schedulers import these constants rather than hard-coding strings.
 *
 * Call architecture note: the actual incoming call is drawn by the NATIVE incoming-call surface
 * (a CallStyle + full-screen-intent notification on NATIVE_CALL_CHANNEL_ID, posted from Kotlin).
 * On the JS side, a call reminder fires a SILENT, low-importance "heartbeat" notification
 * (CALL_HEARTBEAT_CHANNEL_ID) whose only job is to run the Notifee trigger and emit the DELIVERED
 * event; the foreground/background handlers then ask the native side to ring and cancel the
 * heartbeat. So there is no longer a loud, user-facing JS call channel.
 */

import notifee, {
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { reminderLog } from './logger';

/** Silent alarm carrier for calls: fires the trigger + DELIVERED event, then is cancelled. */
export const CALL_HEARTBEAT_CHANNEL_ID = 'call-heartbeat-v1';

/**
 * High-importance, silent channel the NATIVE CallStyle notification uses. Created here too so it
 * exists from startup (for health inspection); the native side reuses it. Keep this id in sync
 * with CallConstants.NOTIFICATION_CHANNEL_ID in the Kotlin incomingcall package.
 */
export const NATIVE_CALL_CHANNEL_ID = 'incoming-call-native-v1';

export const HABIT_PUSH_CHANNEL_ID = 'habit-push-v2';

/**
 * Audible channel for missed-reminder follow-ups (no full-screen, no loop). Audible — not silent —
 * so the user actually notices they missed a call. Kept in sync with the native
 * CallConstants.MISSED_CHANNEL_ID (the foreground service posts on this same channel).
 */
export const MISSED_CHANNEL_ID = 'reminder-missed-v2';

type ChannelDef = {
  id: string;
  name: string;
  description: string;
  importance: AndroidImportance;
  silent: boolean;
  /** Whether this channel's health is surfaced as a "calls can ring" dependency. */
  call: boolean;
};

export const CHANNEL_DEFS: ChannelDef[] = [
  {
    id: NATIVE_CALL_CHANNEL_ID,
    name: 'Incoming Calls',
    description: 'Full-screen incoming voice-assistant calls',
    importance: AndroidImportance.HIGH,
    silent: true, // the native ring screen plays the looping ringtone
    call: true,
  },
  {
    id: CALL_HEARTBEAT_CHANNEL_ID,
    name: 'Call Delivery',
    description: 'Internal: wakes the app to ring a call (no sound of its own)',
    importance: AndroidImportance.LOW,
    silent: true,
    call: false,
  },
  {
    id: HABIT_PUSH_CHANNEL_ID,
    name: 'Habit Push Reminders',
    description: 'Standard push notifications for habit reminders',
    importance: AndroidImportance.HIGH,
    silent: false,
    call: false,
  },
  {
    id: MISSED_CHANNEL_ID,
    name: 'Missed Reminders',
    description: 'Audible follow-ups when a reminder call was missed or arrived late',
    importance: AndroidImportance.HIGH,
    silent: false,
    call: false,
  },
];

export const CALL_CHANNEL_IDS = CHANNEL_DEFS.filter(c => c.call).map(c => c.id);

// Superseded channel ids from earlier versions (including the old loud per-family call channels,
// now replaced by the native call surface). Deleted on startup so upgrading users don't keep
// stale "Meal Logging Calls"/"Habit Voice Reminders" entries in system settings.
const DEPRECATED_CHANNEL_IDS = [
  'meal-call-v2',
  'meal-call-v3',
  'habit-call-v1',
  'habit-call-v2',
  'habit-push-v1',
  // Superseded by reminder-missed-v2 (made audible so missed-call follow-ups are noticed).
  'reminder-missed-v1',
];

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
      importance: def.importance,
      visibility: AndroidVisibility.PUBLIC,
      // DND honesty (§C): bypassDnd requires user-granted DND access which we don't request.
      bypassDnd: false,
      vibration: !def.silent,
      sound: def.silent ? undefined : 'default',
      lights: true,
      lightColor: '#10b981',
    });
  }
}

export type ChannelHealth = {
  id: string;
  exists: boolean;
  blocked: boolean;
  /** Lowered below HIGH by the user; reduces heads-up behaviour. */
  loweredImportance: boolean;
};

/**
 * Inspects the call channels users most rely on. Users can mute, lower, or delete a channel;
 * because channel settings are immutable we can only detect and prompt.
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
