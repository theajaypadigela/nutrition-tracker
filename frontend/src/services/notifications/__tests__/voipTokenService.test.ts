import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { notificationApi } from '@/services/api/notificationApi';
import { getVoipToken } from '../nativeIncomingCall';
import {
  registerIosVoipToken,
  unregisterCurrentIosVoipToken,
} from '../voipTokenService';
import { isIosVoipTokenRegistered } from '../voipRegistrationStore';

jest.mock('@/services/api/notificationApi', () => ({
  notificationApi: {
    registerIosVoipToken: jest.fn(),
    unregisterIosVoipToken: jest.fn(),
  },
}));

jest.mock('../nativeIncomingCall', () => ({
  getVoipToken: jest.fn(),
}));

const mockApi = notificationApi as jest.Mocked<typeof notificationApi>;
const mockGetVoipToken = getVoipToken as jest.Mock;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
});

it('sets the remote-delivery flag only after registration succeeds', async () => {
  mockApi.registerIosVoipToken.mockResolvedValueOnce({});

  await expect(registerIosVoipToken('push-token')).resolves.toBe(true);
  expect(mockApi.registerIosVoipToken).toHaveBeenCalledWith('push-token');
  await expect(isIosVoipTokenRegistered()).resolves.toBe(true);
});

it('clears the flag when registration fails so local fallback remains enabled', async () => {
  mockApi.registerIosVoipToken.mockRejectedValueOnce(new Error('offline'));

  await expect(registerIosVoipToken('push-token')).resolves.toBe(false);
  await expect(isIosVoipTokenRegistered()).resolves.toBe(false);
});

it('unregisters before logout with the current native token and clears local state', async () => {
  await AsyncStorage.setItem('token', 'auth-token');
  mockGetVoipToken.mockResolvedValueOnce('push-token');
  mockApi.unregisterIosVoipToken.mockResolvedValueOnce({});

  await expect(unregisterCurrentIosVoipToken()).resolves.toBe(true);
  expect(mockApi.unregisterIosVoipToken).toHaveBeenCalledWith('push-token');
  await expect(isIosVoipTokenRegistered()).resolves.toBe(false);
});

it('does not recurse through the authenticated DELETE after a 401 already cleared auth', async () => {
  mockGetVoipToken.mockResolvedValueOnce('push-token');

  await expect(unregisterCurrentIosVoipToken()).resolves.toBe(true);
  expect(mockApi.unregisterIosVoipToken).not.toHaveBeenCalled();
});
