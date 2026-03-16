import { Platform, Vibration } from 'react-native';
import notifee from '@notifee/react-native';
import { navigationRef } from '../navigation/AppNavigator';
import { clearMealRescheduleTime } from '../services/mealScheduler';
import { stopRingtone } from './useRingtone';

type CallKeepModule = {
  answerIncomingCall?: (callKeepId: string) => void;
  rejectCall?: (callKeepId: string) => void;
};

const callKeep: CallKeepModule | null =
  Platform.OS === 'ios'
    ? ((require('react-native-callkeep')?.default ??
        require('react-native-callkeep')) as CallKeepModule)
    : null;

export type IncomingCallType = 'meal' | 'habit';

export type IncomingCallPayload = {
  type: IncomingCallType;
  callId?: string;
  notificationId?: string;
  mealSlotId?: string;
  habitId?: string;
  habitName?: string;
  habitTime?: string;
};

type HandleCallOptions = {
  skipNavigation?: boolean;
};

let activeCallNotificationId: string | null = null;

export function setActiveCallNotificationId(id: string | null) {
  activeCallNotificationId = id;
}

// ─── In-app call banner callbacks ────────────────────────────────────────────

let callBannerCallback: ((payload: IncomingCallPayload | null) => void) | null = null;

export function registerCallBannerCallback(
  cb: (payload: IncomingCallPayload | null) => void,
) {
  callBannerCallback = cb;
}

export function showCallBanner(payload: IncomingCallPayload) {
  callBannerCallback?.(payload);
}

export function hideCallBanner() {
  callBannerCallback?.(null);
}

function resolveCallKeepId(payload: IncomingCallPayload): string {
  if (payload.callId) {
    return payload.callId;
  }

  if (payload.type === 'habit') {
    return `habit-${payload.habitId ?? payload.habitTime ?? 'incoming'}`;
  }

  return `meal-${payload.mealSlotId ?? 'incoming'}`;
}

async function cancelCallNotifications(notificationId?: string) {
  const idToCancel = notificationId ?? activeCallNotificationId;

  if (idToCancel) {
    await notifee.cancelNotification(idToCancel).catch(() => {});
  }

  activeCallNotificationId = null;

  // Safety net for sticky call notifications across all channels.
  await notifee.cancelAllNotifications().catch(() => {});
}

function navigateWhenReady(runNavigate: () => void, attempts = 0) {
  if (navigationRef.isReady()) {
    runNavigate();
    return;
  }

  if (attempts > 20) {
    return;
  }

  setTimeout(() => navigateWhenReady(runNavigate, attempts + 1), 150);
}

function answerIncomingCall(callKeepId: string) {
  if (!callKeep?.answerIncomingCall) {
    return;
  }

  try {
    callKeep.answerIncomingCall(callKeepId);
  } catch {
    // Ignore bridge or setup errors; notification cleanup still proceeds.
  }
}

function rejectIncomingCall(callKeepId: string) {
  if (!callKeep?.rejectCall) {
    return;
  }

  try {
    callKeep.rejectCall(callKeepId);
  } catch {
    // Ignore bridge or setup errors; notification cleanup still proceeds.
  }
}

export async function handleAcceptCall(
  payload: IncomingCallPayload,
  options: HandleCallOptions = {},
) {
  hideCallBanner();
  await cancelCallNotifications(payload.notificationId);
  stopRingtone();
  Vibration.cancel();

  const callKeepId = resolveCallKeepId(payload);
  answerIncomingCall(callKeepId);

  if (payload.type === 'meal') {
    await clearMealRescheduleTime().catch(() => {});
  }

  if (options.skipNavigation) {
    return;
  }

  navigateWhenReady(() => {
    if (payload.type === 'habit') {
      (navigationRef as any).current?.navigate('VoiceHabit', {
        habitId: payload.habitId,
        habitName: payload.habitName,
        habitTime: payload.habitTime,
        autoStart: true,
      });
      return;
    }

    (navigationRef as any).current?.navigate('VoiceMealLog', {
      mealSlotId: payload.mealSlotId,
      autoStart: true,
    });
  });
}

export async function handleDeclineCall(
  payload: IncomingCallPayload,
  options: HandleCallOptions = {},
) {
  hideCallBanner();
  await cancelCallNotifications(payload.notificationId);
  stopRingtone();
  Vibration.cancel();

  const callKeepId = resolveCallKeepId(payload);
  rejectIncomingCall(callKeepId);

  if (options.skipNavigation) {
    return;
  }

  navigateWhenReady(() => {
    const canGoBack = (navigationRef as any).current?.canGoBack?.();
    if (canGoBack) {
      (navigationRef as any).current?.goBack();
      return;
    }

    (navigationRef as any).current?.navigate('MainTabs');
  });
}
