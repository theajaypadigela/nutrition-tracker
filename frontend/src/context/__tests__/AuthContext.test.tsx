import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../AuthContext';
import { authApi } from '../../services/api/authApi';
import {
  onLoginReminders,
  onLogoutReminders,
} from '../../services/notifications/reminderService';

// Mock at the service boundary: AuthContext's job is token storage + user state +
// reminder side-effects. The HTTP request shapes are covered by services/api/__tests__.
jest.mock('../../services/api/authApi', () => ({
  authApi: {
    me: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
    updateProfile: jest.fn(),
  },
}));

jest.mock('../../services/notifications/reminderService', () => ({
  onLoginReminders: jest.fn(() => Promise.resolve()),
  onLogoutReminders: jest.fn(() => Promise.resolve()),
}));

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;

type AuthApi = ReturnType<typeof useAuth>;

// Renders the provider and exposes the live context value to the test.
async function setupAuth(): Promise<{ current: () => AuthApi }> {
  let value: AuthApi | undefined;
  const Capture = () => {
    value = useAuth();
    return null;
  };
  await act(async () => {
    ReactTestRenderer.create(
      <AuthProvider>
        <Capture />
      </AuthProvider>,
    );
  });
  return { current: () => value as AuthApi };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('AuthContext', () => {
  it('starts unauthenticated once initialization finishes (no stored token)', async () => {
    const ctx = await setupAuth();
    expect(ctx.current().isAuthenticated).toBe(false);
    expect(ctx.current().user).toBeNull();
    expect(ctx.current().isInitializing).toBe(false);
    expect(mockAuthApi.me).not.toHaveBeenCalled();
  });

  it('hydrates the user from /auth/me when a token is already stored', async () => {
    await AsyncStorage.setItem('token', 'tok-existing');
    mockAuthApi.me.mockResolvedValueOnce({
      id: '1',
      name: 'Ada',
      email: 'ada@x.io',
    });

    const ctx = await setupAuth();

    expect(mockAuthApi.me).toHaveBeenCalledTimes(1);
    expect(ctx.current().user?.id).toBe('1');
    expect(ctx.current().isAuthenticated).toBe(true);
    expect(onLoginReminders).toHaveBeenCalledTimes(1);
  });

  it('login persists the token, sets the user, and rebuilds reminders', async () => {
    const ctx = await setupAuth();
    mockAuthApi.login.mockResolvedValueOnce({
      token: 'tok-123',
      id: '1',
      name: 'Ada',
      email: 'ada@x.io',
      age: '30',
      gender: 'f',
    });

    await act(async () => {
      await ctx.current().login('ada@x.io', 'pw');
    });

    expect(mockAuthApi.login).toHaveBeenCalledWith('ada@x.io', 'pw');
    expect(await AsyncStorage.getItem('token')).toBe('tok-123');
    expect(ctx.current().user).toEqual({
      id: '1',
      name: 'Ada',
      email: 'ada@x.io',
      age: '30',
      gender: 'f',
    });
    expect(ctx.current().isAuthenticated).toBe(true);
    expect(onLoginReminders).toHaveBeenCalledTimes(1);
  });

  it('login throws and stores nothing when the server returns no token', async () => {
    const ctx = await setupAuth();
    mockAuthApi.login.mockResolvedValueOnce({ id: '1' } as any);

    await act(async () => {
      await expect(ctx.current().login('a@b.c', 'pw')).rejects.toThrow(
        'No access token received from server',
      );
    });

    expect(await AsyncStorage.getItem('token')).toBeNull();
    expect(ctx.current().isAuthenticated).toBe(false);
  });

  it('register creates the account then logs in', async () => {
    const ctx = await setupAuth();
    mockAuthApi.register.mockResolvedValueOnce({});
    mockAuthApi.login.mockResolvedValueOnce({
      token: 'tok-9',
      id: '7',
      name: 'Bo',
      email: 'bo@x.io',
      age: '22',
      gender: 'm',
    });

    await act(async () => {
      await ctx.current().register('Bo', 'bo@x.io', 'pw', '2000-05-15', 'm');
    });

    expect(mockAuthApi.register).toHaveBeenCalledWith(
      'Bo',
      'bo@x.io',
      'pw',
      '2000-05-15',
      'm',
    );
    expect(mockAuthApi.login).toHaveBeenCalledWith('bo@x.io', 'pw');
    expect(await AsyncStorage.getItem('token')).toBe('tok-9');
    expect(ctx.current().user?.id).toBe('7');
  });

  it('logout clears the token, the user, and local reminder state', async () => {
    const ctx = await setupAuth();
    await AsyncStorage.setItem('token', 'tok-123');

    await act(async () => {
      await ctx.current().logout();
    });

    expect(await AsyncStorage.getItem('token')).toBeNull();
    expect(ctx.current().user).toBeNull();
    expect(ctx.current().isAuthenticated).toBe(false);
    expect(onLogoutReminders).toHaveBeenCalledTimes(1);
  });

  it('updateProfile replaces the user from the server response', async () => {
    const ctx = await setupAuth();
    mockAuthApi.updateProfile.mockResolvedValueOnce({
      id: '1',
      name: 'Ada Lovelace',
      email: 'ada@x.io',
      age: '31',
      gender: 'f',
    });

    await act(async () => {
      await ctx.current().updateProfile('Ada Lovelace', '31', 'f');
    });

    expect(mockAuthApi.updateProfile).toHaveBeenCalledWith(
      'Ada Lovelace',
      '31',
      'f',
    );
    expect(ctx.current().user?.name).toBe('Ada Lovelace');
  });
});
