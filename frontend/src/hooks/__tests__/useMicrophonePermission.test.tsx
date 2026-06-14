import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useMicrophonePermission } from '../useMicrophonePermission';
import { check, request } from 'react-native-permissions';

jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    IOS: { MICROPHONE: 'ios.microphone' },
    ANDROID: { RECORD_AUDIO: 'android.record_audio' },
  },
  RESULTS: { GRANTED: 'granted', DENIED: 'denied' },
  check: jest.fn(),
  request: jest.fn(),
}));

const mockCheck = check as jest.Mock;
const mockRequest = request as jest.Mock;

function renderPermissionFn() {
  const ref: { current: () => Promise<boolean> } = { current: null as any };
  function Harness() {
    ref.current = useMicrophonePermission();
    return null;
  }
  act(() => {
    ReactTestRenderer.create(<Harness />);
  });
  return ref;
}

beforeEach(() => jest.clearAllMocks());

describe('useMicrophonePermission', () => {
  it('returns true without prompting when already granted', async () => {
    mockCheck.mockResolvedValueOnce('granted');
    const fn = renderPermissionFn();
    let result: boolean | undefined;
    await act(async () => {
      result = await fn.current();
    });
    expect(result).toBe(true);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('prompts and returns true when the request is granted', async () => {
    mockCheck.mockResolvedValueOnce('denied');
    mockRequest.mockResolvedValueOnce('granted');
    const fn = renderPermissionFn();
    let result: boolean | undefined;
    await act(async () => {
      result = await fn.current();
    });
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it('returns false when the request is denied', async () => {
    mockCheck.mockResolvedValueOnce('denied');
    mockRequest.mockResolvedValueOnce('denied');
    const fn = renderPermissionFn();
    let result: boolean | undefined;
    await act(async () => {
      result = await fn.current();
    });
    expect(result).toBe(false);
  });
});
