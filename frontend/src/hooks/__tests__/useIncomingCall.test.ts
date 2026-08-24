import notifee from '@notifee/react-native';
import { navigationRef } from '@/navigation/navigationRef';
import {
  navigateToIncomingCall,
  navigateToVoiceMealLog,
} from '@/navigation/navigationUtils';
import {
  onCallAccepted,
  onCallDeclined,
} from '@/services/notifications/callLifecycle';
import { dismissIncomingCall } from '@/services/notifications/nativeIncomingCall';
import { clearMealReschedule } from '@/services/notifications/reminderService';
import {
  handleAcceptCall,
  handleDeclineCall,
  showIncomingCall,
} from '../useIncomingCall';

jest.mock('@/navigation/navigationRef', () => ({
  navigationRef: { isReady: jest.fn(() => true) },
}));

jest.mock('@/navigation/navigationUtils', () => ({
  goBackOrMainTabs: jest.fn(),
  navigateToIncomingCall: jest.fn(),
  navigateToVoiceHabit: jest.fn(),
  navigateToVoiceMealLog: jest.fn(),
}));

jest.mock('@/services/notifications/callLifecycle', () => ({
  onCallAccepted: jest.fn(),
  onCallDeclined: jest.fn(),
}));

jest.mock('@/services/notifications/nativeIncomingCall', () => ({
  dismissIncomingCall: jest.fn(),
}));

jest.mock('@/services/notifications/reminderService', () => ({
  clearMealReschedule: jest.fn(),
}));

const mockOnAccepted = onCallAccepted as jest.Mock;
const mockOnDeclined = onCallDeclined as jest.Mock;
const mockClearMealReschedule = clearMealReschedule as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (notifee.cancelDisplayedNotification as jest.Mock).mockResolvedValue(undefined);
  (navigationRef.isReady as jest.Mock).mockReturnValue(true);
  mockOnAccepted.mockResolvedValue(undefined);
  mockOnDeclined.mockResolvedValue(undefined);
  mockClearMealReschedule.mockResolvedValue(undefined);
});

it('accepts once and routes to the existing voice screen with autoStart', async () => {
  await handleAcceptCall({
    type: 'meal',
    notificationId: 'meal-1',
    mealSlotId: 'daily',
    reminderKind: 'meal-call',
  });

  expect(notifee.cancelDisplayedNotification).toHaveBeenCalledWith('meal-1');
  expect(mockOnAccepted).toHaveBeenCalledTimes(1);
  expect(mockClearMealReschedule).toHaveBeenCalledTimes(1);
  expect(navigateToVoiceMealLog).toHaveBeenCalledWith({
    mealSlotId: 'daily',
    autoStart: true,
  });
});

it('declines through the full lifecycle without navigating from a headless handler', async () => {
  await handleDeclineCall(
    {
      type: 'meal',
      notificationId: 'meal-1',
      reminderKind: 'meal-call',
    },
    { skipNavigation: true },
  );

  expect(dismissIncomingCall).toHaveBeenCalledTimes(1);
  expect(notifee.cancelDisplayedNotification).toHaveBeenCalledWith('meal-1');
  expect(mockOnDeclined).toHaveBeenCalledTimes(1);
  expect(mockClearMealReschedule).toHaveBeenCalledTimes(1);
  expect(navigateToVoiceMealLog).not.toHaveBeenCalled();
});

it('shows the fallback screen without accepting or dismissing the native call', () => {
  const payload = { type: 'habit' as const, notificationId: 'habit-1' };

  showIncomingCall(payload);

  expect(navigateToIncomingCall).toHaveBeenCalledWith(payload);
  expect(mockOnAccepted).not.toHaveBeenCalled();
  expect(dismissIncomingCall).not.toHaveBeenCalled();
});
