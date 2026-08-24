import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { navigationRef } from '@/navigation/navigationRef';
import { navigateToIncomingCall } from '@/navigation/navigationUtils';
import { StorageKeys } from '@/services/storage/storageKeys';
import { usePendingAcceptNavigation } from '../usePendingAcceptNavigation';

jest.mock('@/navigation/navigationRef', () => ({
  navigationRef: { isReady: jest.fn(() => true) },
}));

jest.mock('@/navigation/navigationUtils', () => ({
  navigateToIncomingCall: jest.fn(),
  navigateToVoiceHabit: jest.fn(),
  navigateToVoiceMealLog: jest.fn(),
}));

const mockNavigateToIncomingCall = navigateToIncomingCall as jest.Mock;

beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  await AsyncStorage.clear();
  (navigationRef.isReady as jest.Mock).mockReturnValue(true);
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

it('observes a separate headless write that lands after the UI initial read', async () => {
  function Harness() {
    usePendingAcceptNavigation(false, true);
    return null;
  }

  let renderer: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<Harness />);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(mockNavigateToIncomingCall).not.toHaveBeenCalled();

  const pending = {
    screen: 'IncomingCall',
    payload: { type: 'meal', notificationId: 'meal-late', mealSlotId: 'daily' },
  };
  // Direct storage write simulates another RN bridge, so no in-memory subscriber fires.
  await AsyncStorage.setItem(
    StorageKeys.pendingCallNavigation,
    JSON.stringify(pending),
  );

  await act(async () => {
    jest.advanceTimersByTime(300);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(mockNavigateToIncomingCall).toHaveBeenCalledWith(pending.payload);
  expect(await AsyncStorage.getItem(StorageKeys.pendingCallNavigation)).toBeNull();

  act(() => renderer!.unmount());
});

it('leaves the hand-off persisted until the authenticated root stack is available', async () => {
  const pending = {
    screen: 'IncomingCall',
    payload: { type: 'meal', notificationId: 'meal-auth', mealSlotId: 'daily' },
  };
  await AsyncStorage.setItem(
    StorageKeys.pendingCallNavigation,
    JSON.stringify(pending),
  );

  function Harness({ authenticated }: { authenticated: boolean }) {
    usePendingAcceptNavigation(false, authenticated);
    return null;
  }

  let renderer: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<Harness authenticated={false} />);
    await Promise.resolve();
  });
  expect(mockNavigateToIncomingCall).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(StorageKeys.pendingCallNavigation)).not.toBeNull();

  await act(async () => {
    renderer!.update(<Harness authenticated />);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(mockNavigateToIncomingCall).toHaveBeenCalledWith(pending.payload);
  expect(await AsyncStorage.getItem(StorageKeys.pendingCallNavigation)).toBeNull();

  act(() => renderer!.unmount());
});
