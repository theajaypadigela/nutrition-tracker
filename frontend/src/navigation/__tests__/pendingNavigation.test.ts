import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from '@/services/storage/storageKeys';
import {
  setPendingAcceptNavigation,
  takePendingAcceptNavigation,
} from '../pendingNavigation';

beforeEach(async () => {
  await AsyncStorage.clear();
  await setPendingAcceptNavigation(null);
});

describe('pending call navigation', () => {
  it('persists a headless hand-off and consumes it once', async () => {
    const pending = {
      screen: 'IncomingCall' as const,
      payload: {
        type: 'habit' as const,
        notificationId: 'habit-1',
        habitId: 'h1',
      },
    };

    await setPendingAcceptNavigation(pending);

    expect(await AsyncStorage.getItem(StorageKeys.pendingCallNavigation)).toBe(
      JSON.stringify(pending),
    );
    await expect(takePendingAcceptNavigation()).resolves.toEqual(pending);
    await expect(takePendingAcceptNavigation()).resolves.toBeNull();
  });

  it('drops malformed persisted navigation instead of navigating arbitrary data', async () => {
    await AsyncStorage.setItem(
      StorageKeys.pendingCallNavigation,
      JSON.stringify({ screen: 'IncomingCall', payload: { type: 'unknown' } }),
    );

    await expect(takePendingAcceptNavigation()).resolves.toBeNull();
    expect(await AsyncStorage.getItem(StorageKeys.pendingCallNavigation)).toBeNull();
  });
});
