import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Platform } from 'react-native';
import {
  getVoipToken,
  subscribeToVoipTokenUpdates,
} from '@/services/notifications/nativeIncomingCall';
import { reconcileReminders } from '@/services/notifications/reminderService';
import {
  isIosVoipTokenRegistered,
  setIosVoipTokenRegistered,
} from '@/services/notifications/voipRegistrationStore';
import { registerIosVoipToken } from '@/services/notifications/voipTokenService';
import { useVoipTokenSync } from '../useVoipTokenSync';

jest.mock('@/services/notifications/nativeIncomingCall', () => ({
  getVoipToken: jest.fn(),
  subscribeToVoipTokenUpdates: jest.fn(),
}));

jest.mock('@/services/notifications/reminderService', () => ({
  reconcileReminders: jest.fn(),
}));

jest.mock('@/services/notifications/voipRegistrationStore', () => ({
  isIosVoipTokenRegistered: jest.fn(),
  setIosVoipTokenRegistered: jest.fn(),
}));

jest.mock('@/services/notifications/voipTokenService', () => ({
  registerIosVoipToken: jest.fn(),
}));

const mockGetVoipToken = getVoipToken as jest.Mock;
const mockSubscribe = subscribeToVoipTokenUpdates as jest.Mock;
const mockReconcile = reconcileReminders as jest.Mock;
const mockReadRegistered = isIosVoipTokenRegistered as jest.Mock;
const mockSetRegistered = setIosVoipTokenRegistered as jest.Mock;
const mockRegister = registerIosVoipToken as jest.Mock;

let tokenListener: ((token: string | null) => void) | undefined;

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  tokenListener = undefined;
  mockGetVoipToken.mockResolvedValue('push-token');
  mockReadRegistered.mockResolvedValue(false);
  mockSetRegistered.mockResolvedValue(undefined);
  mockRegister.mockResolvedValue(true);
  mockReconcile.mockResolvedValue(undefined);
  mockSubscribe.mockImplementation(listener => {
    tokenListener = listener;
    return jest.fn();
  });
});

it('registers after authentication and resyncs when native rotates the token', async () => {
  function Harness() {
    useVoipTokenSync(false, true);
    return null;
  }

  let renderer: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<Harness />);
  });
  await flush();

  expect(mockRegister).toHaveBeenCalledWith('push-token');
  expect(mockReconcile).toHaveBeenCalledWith('resume', true);

  act(() => tokenListener?.('rotated-token'));
  await flush();

  expect(mockRegister).toHaveBeenCalledWith('rotated-token');
  act(() => renderer!.unmount());
});

it('clears registration state on native token invalidation without logging token data', async () => {
  mockReadRegistered.mockResolvedValue(true);
  function Harness() {
    useVoipTokenSync(false, true);
    return null;
  }

  let renderer: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<Harness />);
  });
  await flush();
  mockSetRegistered.mockClear();
  mockReconcile.mockClear();

  act(() => tokenListener?.(null));
  await flush();

  expect(mockSetRegistered).toHaveBeenCalledWith(false);
  expect(mockReconcile).toHaveBeenCalledWith('resume', true);
  act(() => renderer!.unmount());
});
