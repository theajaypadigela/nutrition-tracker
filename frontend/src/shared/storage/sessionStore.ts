import AsyncStorage from '@react-native-async-storage/async-storage';

import { AUTHENTICATED_USER_ID_STORAGE_KEY, TOKEN_STORAGE_KEY } from './keys';

export interface SessionStore {
  getToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
  clearToken(): Promise<void>;
  getUserId(): Promise<string | null>;
  setUserId(userId: string): Promise<void>;
  setSession(token: string, userId: string): Promise<void>;
  clearSession(): Promise<void>;
}

export const sessionStore: SessionStore = {
  getToken: () => AsyncStorage.getItem(TOKEN_STORAGE_KEY),
  setToken: token => AsyncStorage.setItem(TOKEN_STORAGE_KEY, token),
  clearToken: () => AsyncStorage.removeItem(TOKEN_STORAGE_KEY),
  getUserId: () => AsyncStorage.getItem(AUTHENTICATED_USER_ID_STORAGE_KEY),
  setUserId: userId =>
    AsyncStorage.setItem(AUTHENTICATED_USER_ID_STORAGE_KEY, userId),
  setSession: async (token, userId) => {
    await Promise.all([
      AsyncStorage.setItem(TOKEN_STORAGE_KEY, token),
      AsyncStorage.setItem(AUTHENTICATED_USER_ID_STORAGE_KEY, userId),
    ]);
  },
  clearSession: async () => {
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_STORAGE_KEY),
      AsyncStorage.removeItem(AUTHENTICATED_USER_ID_STORAGE_KEY),
    ]);
  },
};
