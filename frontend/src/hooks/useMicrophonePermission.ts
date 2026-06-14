import { useCallback } from 'react';
import { Platform } from 'react-native';
import { PERMISSIONS, RESULTS, check, request } from 'react-native-permissions';

/**
 * Returns a callback that ensures microphone permission, prompting once if not already
 * granted. Shared by the voice habit + voice meal-log screens.
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
    const requested = await request(perm);
    return requested === RESULTS.GRANTED;
  }, []);
}
