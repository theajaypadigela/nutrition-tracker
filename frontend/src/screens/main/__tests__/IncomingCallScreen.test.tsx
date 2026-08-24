import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  handleAcceptCall,
  handleDeclineCall,
} from '@/hooks/useIncomingCall';
import { claimAction } from '@/services/notifications/processedActions';
import IncomingCallScreen from '../IncomingCallScreen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
}));

jest.mock('@/hooks/useIncomingCall', () => ({
  handleAcceptCall: jest.fn(),
  handleDeclineCall: jest.fn(),
}));

jest.mock('@/services/notifications/processedActions', () => ({
  claimAction: jest.fn(),
}));

const mockUseNavigation = useNavigation as jest.Mock;
const mockUseRoute = useRoute as jest.Mock;
const mockHandleAccept = handleAcceptCall as jest.Mock;
const mockHandleDecline = handleDeclineCall as jest.Mock;
const mockClaim = claimAction as jest.Mock;
const goBack = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockUseNavigation.mockReturnValue({ goBack });
  mockUseRoute.mockReturnValue({
    params: { type: 'meal', notificationId: 'meal-1', mealSlotId: 'daily' },
  });
  mockClaim.mockResolvedValue(true);
  mockHandleAccept.mockResolvedValue(undefined);
  mockHandleDecline.mockResolvedValue(undefined);
});

it('does not start voice until the user explicitly presses Answer', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<IncomingCallScreen />);
  });

  expect(mockHandleAccept).not.toHaveBeenCalled();
  const answer = renderer!.root
    .findAllByType(TouchableOpacity)
    .find(node => node.props.accessibilityLabel === 'Answer call');

  await act(async () => answer!.props.onPress());

  expect(mockClaim).toHaveBeenCalledWith('meal-1:accept');
  expect(goBack).toHaveBeenCalledTimes(1);
  expect(mockHandleAccept).toHaveBeenCalledWith({
    type: 'meal',
    notificationId: 'meal-1',
    mealSlotId: 'daily',
  });
  act(() => renderer!.unmount());
});

it('uses the shared decline lifecycle and re-enables controls after a duplicate claim', async () => {
  mockClaim.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  let renderer: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<IncomingCallScreen />);
  });
  const decline = renderer!.root
    .findAllByType(TouchableOpacity)
    .find(node => node.props.accessibilityLabel === 'Decline call');

  await act(async () => decline!.props.onPress());
  expect(decline!.props.disabled).toBe(false);

  await act(async () => decline!.props.onPress());
  expect(mockHandleDecline).toHaveBeenCalledWith(
    { type: 'meal', notificationId: 'meal-1', mealSlotId: 'daily' },
    { skipNavigation: true },
  );
  act(() => renderer!.unmount());
});
