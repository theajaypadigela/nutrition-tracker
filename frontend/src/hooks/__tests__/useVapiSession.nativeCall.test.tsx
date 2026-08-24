import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { initializeVapiClient } from '@/services/vapiSessionService';
import {
  consumePendingHangup,
  dismissIncomingCall,
  subscribeToNativeIncomingCallEvents,
} from '@/services/notifications/nativeIncomingCall';
import { useMicrophonePermission } from '../useMicrophonePermission';
import { useVapiSession, type UseVapiSessionResult } from '../useVapiSession';

jest.mock('@vapi-ai/react-native', () => ({ __esModule: true, default: jest.fn() }));

jest.mock('@/services/vapiSessionService', () => ({
  initializeVapiClient: jest.fn(),
}));

jest.mock('../useMicrophonePermission', () => ({
  useMicrophonePermission: jest.fn(),
}));

jest.mock('@/services/notifications/nativeIncomingCall', () => ({
  consumePendingHangup: jest.fn(),
  dismissIncomingCall: jest.fn(),
  nativeCallActionKey: jest.fn(() => 'call-1:ended'),
  subscribeToNativeIncomingCallEvents: jest.fn(),
}));

jest.mock('@/services/notifications/processedActions', () => ({
  claimAction: jest.fn(() => Promise.resolve(true)),
}));

const mockInitialize = initializeVapiClient as jest.Mock;
const mockUseMicrophonePermission = useMicrophonePermission as jest.Mock;
const mockConsumeHangup = consumePendingHangup as jest.Mock;
const mockDismissIncomingCall = dismissIncomingCall as jest.Mock;
const mockSubscribe = subscribeToNativeIncomingCallEvents as jest.Mock;

let nativeListener: ((event: { result: string }) => void) | undefined;

function createVapi() {
  const listeners: Record<string, (...args: any[]) => void> = {};
  return {
    listeners,
    on: jest.fn((name: string, listener: (...args: any[]) => void) => {
      listeners[name] = listener;
    }),
    start: jest.fn(() => Promise.resolve()),
    stop: jest.fn(),
    setMuted: jest.fn(),
    removeAllListeners: jest.fn(),
  };
}

async function renderSession() {
  const ref: { current?: UseVapiSessionResult } = {};
  function Harness() {
    ref.current = useVapiSession({
      purpose: 'meal',
      logTag: 'TestVapi',
      permissionDeniedMessage: 'permission required',
      getVariableValues: () => ({}),
      onCallEnd: jest.fn(),
    });
    return null;
  }

  let renderer: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<Harness />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { ref, renderer: renderer! };
}

beforeEach(() => {
  jest.clearAllMocks();
  nativeListener = undefined;
  mockUseMicrophonePermission.mockReturnValue(jest.fn(() => Promise.resolve(true)));
  mockConsumeHangup.mockResolvedValue(null);
  mockSubscribe.mockImplementation(listener => {
    nativeListener = listener;
    return jest.fn();
  });
});

it('dismisses an answered native call exactly once when Vapi start fails', async () => {
  mockInitialize.mockRejectedValueOnce(new Error('no session'));
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const { ref, renderer } = await renderSession();

  await act(async () => {
    await ref.current!.startSession();
  });
  expect(mockDismissIncomingCall).toHaveBeenCalledTimes(1);

  act(() => renderer.unmount());
  expect(mockDismissIncomingCall).toHaveBeenCalledTimes(1);
  errorSpy.mockRestore();
});

it('dismisses CallKit even when Stop is pressed before a Vapi instance exists', async () => {
  const { ref, renderer } = await renderSession();

  act(() => ref.current!.stopSession());
  expect(mockDismissIncomingCall).toHaveBeenCalledTimes(1);

  act(() => renderer.unmount());
  expect(mockDismissIncomingCall).toHaveBeenCalledTimes(1);
});

it('stops the active Vapi session when CallKit emits a durable system hang-up', async () => {
  const vapi = createVapi();
  mockInitialize.mockResolvedValueOnce({ vapi, assistantId: 'assistant' });
  const { ref, renderer } = await renderSession();

  await act(async () => {
    await ref.current!.startSession();
  });
  mockConsumeHangup.mockResolvedValueOnce({
    type: 'meal',
    callId: 'call-1',
  });

  await act(async () => {
    nativeListener?.({ result: 'ended' });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(vapi.stop).toHaveBeenCalledTimes(1);
  // The user/system already ended CallKit, so JS does not send a redundant end action.
  expect(mockDismissIncomingCall).not.toHaveBeenCalled();
  act(() => renderer.unmount());
});
