import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from './storageKeys';

/**
 * Sole owner of the auth-token key.
 *
 * The literal `'token'` was previously written out at six call sites across AuthContext and
 * the API client — the one key where a typo logs every user out and a missed removal leaves
 * a dead credential on the device. Reading and clearing it now goes through here.
 */

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(StorageKeys.authToken);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(StorageKeys.authToken, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(StorageKeys.authToken);
}
