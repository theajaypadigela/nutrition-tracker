import { Platform } from 'react-native';
import { notificationApi } from '@/services/api/notificationApi';
import { getVoipToken } from './nativeIncomingCall';
import { setIosVoipTokenRegistered } from './voipRegistrationStore';
import { getToken } from '../storage/tokenStorage';

/** Registers a known native token and records whether local habit-call fallback may be pruned. */
export async function registerIosVoipToken(token: string): Promise<boolean> {
  if (Platform.OS !== 'ios' || token.length === 0) {
    await setIosVoipTokenRegistered(false);
    return false;
  }

  try {
    await notificationApi.registerIosVoipToken(token);
    await setIosVoipTokenRegistered(true);
    return true;
  } catch {
    // A failed registration must retain/re-arm local notifications as the delivery fallback.
    await setIosVoipTokenRegistered(false);
    return false;
  }
}

/** Best-effort logout cleanup while the auth token is still available to the HTTP client. */
export async function unregisterCurrentIosVoipToken(): Promise<boolean> {
  let removed = true;
  try {
    const authToken = await getToken();
    if (Platform.OS === 'ios' && authToken) {
      const token = await getVoipToken();
      if (token) {
        await notificationApi.unregisterIosVoipToken(token);
      }
    }
  } catch {
    removed = false;
  } finally {
    // Never let a stale local success flag suppress the next account's fallback triggers.
    await setIosVoipTokenRegistered(false);
  }
  return removed;
}
