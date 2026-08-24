import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import {
  consumePendingAnswer,
  consumePendingMissedAction,
  subscribeToNativeIncomingCallEvents,
} from '@/services/notifications/nativeIncomingCall';
import { applyCallResultMarkers } from '@/services/notifications/callMarkers';
import { claimAction } from '@/services/notifications/processedActions';
import { handleAcceptCall } from '@/hooks/useIncomingCall';
import { useNativeIncomingCallResults } from '../useNativeIncomingCallResults';

jest.mock('@/services/notifications/nativeIncomingCall', () => ({
  consumePendingAnswer: jest.fn(),
  consumePendingMissedAction: jest.fn(),
  nativeCallActionKey: jest.fn((payload, action) =>
    `${payload.notificationId ?? payload.callId ?? 'unknown'}:${action}`,
  ),
  subscribeToNativeIncomingCallEvents: jest.fn(),
}));

jest.mock('@/services/notifications/callMarkers', () => ({
  applyCallResultMarkers: jest.fn(),
}));

jest.mock('@/services/notifications/processedActions', () => ({
  claimAction: jest.fn(),
}));

jest.mock('@/hooks/useIncomingCall', () => ({
  handleAcceptCall: jest.fn(),
  handleMissedLogNow: jest.fn(),
}));

const mockConsumePendingAnswer = consumePendingAnswer as jest.Mock;
const mockConsumePendingMissedAction = consumePendingMissedAction as jest.Mock;
const mockSubscribe = subscribeToNativeIncomingCallEvents as jest.Mock;
const mockApplyMarkers = applyCallResultMarkers as jest.Mock;
const mockClaimAction = claimAction as jest.Mock;
const mockHandleAcceptCall = handleAcceptCall as jest.Mock;

let nativeListener: ((event: { result: string }) => void) | undefined;

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
  nativeListener = undefined;
  mockConsumePendingAnswer.mockResolvedValue(null);
  mockConsumePendingMissedAction.mockResolvedValue(null);
  mockApplyMarkers.mockResolvedValue(0);
  mockClaimAction.mockResolvedValue(true);
  mockHandleAcceptCall.mockResolvedValue(undefined);
  mockSubscribe.mockImplementation((listener: typeof nativeListener) => {
    nativeListener = listener;
    return jest.fn();
  });
});

it('consumes a persisted iOS answer once when the live event arrives', async () => {
  function Harness() {
    useNativeIncomingCallResults();
    return null;
  }

  let renderer: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<Harness />);
  });
  await flush();

  const payload = { type: 'meal', notificationId: 'meal-1' };
  mockConsumePendingAnswer.mockResolvedValueOnce(payload).mockResolvedValue(null);

  act(() => {
    nativeListener?.({ result: 'answered' });
    nativeListener?.({ result: 'answered' });
  });
  await flush();

  expect(mockClaimAction).toHaveBeenCalledWith('meal-1:accept');
  expect(mockHandleAcceptCall).toHaveBeenCalledTimes(1);
  expect(mockHandleAcceptCall).toHaveBeenCalledWith(payload);

  act(() => renderer!.unmount());
});

it('drains a native decline immediately without starting voice', async () => {
  function Harness() {
    useNativeIncomingCallResults();
    return null;
  }

  let renderer: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<Harness />);
  });
  await flush();
  mockApplyMarkers.mockClear();

  act(() => nativeListener?.({ result: 'declined' }));
  await flush();

  expect(mockApplyMarkers).toHaveBeenCalledTimes(1);
  expect(mockHandleAcceptCall).not.toHaveBeenCalled();
  act(() => renderer!.unmount());
});
