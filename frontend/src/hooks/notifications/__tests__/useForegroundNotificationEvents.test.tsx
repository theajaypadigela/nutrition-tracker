import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Platform } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import {
  onCallDelivered,
  readOccurrenceData,
} from '@/services/notifications/callLifecycle';
import { claimAction } from '@/services/notifications/processedActions';
import {
  handleAcceptCall,
  handleDeclineCall,
  showIncomingCall,
} from '@/hooks/useIncomingCall';
import { presentIncomingCall } from '@/services/notifications/nativeIncomingCall';
import { payloadFromData } from '../callPayload';
import { useForegroundNotificationEvents } from '../useForegroundNotificationEvents';

jest.mock('@/services/notifications/callLifecycle', () => ({
  readOccurrenceData: jest.fn(),
  onCallDelivered: jest.fn(),
  onCallDeclined: jest.fn(),
}));

jest.mock('@/services/notifications/nativeIncomingCall', () => ({
  presentIncomingCall: jest.fn(),
}));

jest.mock('@/services/notifications/processedActions', () => ({
  claimAction: jest.fn(),
}));

jest.mock('@/hooks/useIncomingCall', () => ({
  handleAcceptCall: jest.fn(),
  handleDeclineCall: jest.fn(),
  showIncomingCall: jest.fn(),
}));

jest.mock('../callPayload', () => ({
  payloadFromData: jest.fn(),
}));

const mockOnForegroundEvent = notifee.onForegroundEvent as jest.Mock;
const mockReadOccurrenceData = readOccurrenceData as jest.Mock;
const mockClaimAction = claimAction as jest.Mock;
const mockHandleAcceptCall = handleAcceptCall as jest.Mock;
const mockHandleDeclineCall = handleDeclineCall as jest.Mock;
const mockShowIncomingCall = showIncomingCall as jest.Mock;
const mockPayloadFromData = payloadFromData as jest.Mock;
const mockOnCallDelivered = onCallDelivered as jest.Mock;
const mockPresentIncomingCall = presentIncomingCall as jest.Mock;

type ForegroundHandler = (event: any) => void;

function renderHook(): ForegroundHandler {
  let handler: ForegroundHandler | undefined;
  mockOnForegroundEvent.mockImplementationOnce((next: ForegroundHandler) => {
    handler = next;
    return jest.fn();
  });

  function Harness() {
    useForegroundNotificationEvents();
    return null;
  }

  act(() => {
    ReactTestRenderer.create(<Harness />);
  });

  if (!handler) throw new Error('Foreground handler was not registered');
  return handler;
}

async function flushInteraction(handler: ForegroundHandler, event: any) {
  await act(async () => {
    handler(event);
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  mockReadOccurrenceData.mockReturnValue({
    kind: 'meal-call',
    intendedFireAt: 123,
    isRescheduled: false,
  });
  mockClaimAction.mockResolvedValue(true);
  mockHandleAcceptCall.mockResolvedValue(undefined);
  mockHandleDeclineCall.mockResolvedValue(undefined);
  mockOnCallDelivered.mockResolvedValue({ suppress: false });
  mockPresentIncomingCall.mockReturnValue(true);
  mockPayloadFromData.mockReturnValue({ type: 'meal', notificationId: 'meal-1' });
});

describe('useForegroundNotificationEvents on iOS', () => {
  it('opens the fallback call UI without starting voice when the body is tapped', async () => {
    const handler = renderHook();

    await flushInteraction(handler, {
      type: EventType.PRESS,
      detail: {
        notification: { id: 'meal-1', data: { reminderKind: 'meal-call' } },
        pressAction: { id: 'default' },
      },
    });

    expect(mockClaimAction).toHaveBeenCalledWith('meal-1:open');
    expect(mockShowIncomingCall).toHaveBeenCalledWith({
      type: 'meal',
      notificationId: 'meal-1',
    });
    expect(mockHandleAcceptCall).not.toHaveBeenCalled();
  });

  it('handles the explicit Decline action without starting Vapi', async () => {
    const handler = renderHook();

    await flushInteraction(handler, {
      type: EventType.ACTION_PRESS,
      detail: {
        notification: { id: 'meal-1', data: { reminderKind: 'meal-call' } },
        pressAction: { id: 'decline' },
      },
    });

    expect(mockClaimAction).toHaveBeenCalledWith('meal-1:decline');
    expect(mockHandleDeclineCall).toHaveBeenCalledWith(
      { type: 'meal', notificationId: 'meal-1' },
      { skipNavigation: true },
    );
    expect(mockHandleAcceptCall).not.toHaveBeenCalled();
  });

  it('does not act when another cold-start path already claimed the tap', async () => {
    mockClaimAction.mockResolvedValueOnce(false);
    const handler = renderHook();

    await flushInteraction(handler, {
      type: EventType.ACTION_PRESS,
      detail: {
        notification: { id: 'meal-1', data: { reminderKind: 'meal-call' } },
        pressAction: { id: 'accept' },
      },
    });

    expect(mockHandleAcceptCall).not.toHaveBeenCalled();
    expect(mockHandleDeclineCall).not.toHaveBeenCalled();
  });

  it('promotes a fresh foreground delivery to native CallKit and removes its duplicate banner', async () => {
    const handler = renderHook();

    await flushInteraction(handler, {
      type: EventType.DELIVERED,
      detail: {
        notification: { id: 'meal-1', data: { reminderKind: 'meal-call' } },
      },
    });

    expect(mockPresentIncomingCall).toHaveBeenCalledWith({
      type: 'meal',
      notificationId: 'meal-1',
    });
    expect(notifee.cancelDisplayedNotification).toHaveBeenCalledWith('meal-1');
  });
});
