import { useCallback } from 'react';
import { Platform } from 'react-native';
import { PERMISSIONS, RESULTS, check, request } from 'react-native-permissions';
import { reminderLog } from '@/services/notifications/logger';

/**
 * Returns a callback that ensures microphone permission, prompting once if not already
 * granted. Shared by the voice habit + voice meal-log screens.
 *
 * UNAVAILABLE is deliberately NOT treated as a denial. It means the handler could not be
 * consulted at all — on iOS that is what react-native-permissions returns when the
 * Microphone handler pod was never compiled in (`setup_permissions` missing from the
 * Podfile), and it is also what a device without a microphone returns. Failing the call
 * closed there is wrong twice over: it blocks the call with a "permission denied" alert the
 * user can do nothing about, and it hides the misconfiguration. Instead we log it and let
 * the call proceed — the WebRTC transport triggers the system microphone prompt itself when
 * it opens the audio session, so the user still gets a real, actionable prompt.
 */
export function useMicrophonePermission() {
  return useCallback(async (): Promise<boolean> => {
    const perm =
      Platform.OS === 'ios'
        ? PERMISSIONS.IOS.MICROPHONE
        : PERMISSIONS.ANDROID.RECORD_AUDIO;
    const result = await check(perm);
    if (result === RESULTS.GRANTED) {
      return true;
    }
    if (result === RESULTS.UNAVAILABLE) {
      reminderLog.warn(
        'mic.handler_unavailable',
        'Microphone permission could not be queried; deferring to the OS capture prompt',
        { platform: Platform.OS },
      );
      return true;
    }
    const requested = await request(perm);
    return requested === RESULTS.GRANTED;
  }, []);
}
