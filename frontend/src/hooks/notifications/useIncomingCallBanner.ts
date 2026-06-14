import { useEffect, useState } from 'react';
import { ROUTES } from '../../navigation/routeNames';
import { navigateToIncomingCall } from '../../navigation/navigationUtils';
import {
  registerCallBannerCallback,
  type IncomingCallPayload,
} from '../useIncomingCall';

/**
 * Owns the in-app call banner payload state, registers the banner callback so the call
 * handlers can show/hide it, and provides the expand handler that opens the full-screen
 * incoming call.
 */
export function useIncomingCallBanner() {
  const [callBannerPayload, setCallBannerPayload] =
    useState<IncomingCallPayload | null>(null);

  // Wire the banner callback so handleAccept/handleDecline can dismiss it.
  useEffect(() => {
    registerCallBannerCallback(setCallBannerPayload);
  }, []);

  const handleBannerExpand = (payload: IncomingCallPayload) => {
    setCallBannerPayload(null);
    if (payload.type === 'habit') {
      navigateToIncomingCall(ROUTES.INCOMING_HABIT_CALL, {
        habitId: payload.habitId,
        habitName: payload.habitName,
        habitTime: payload.habitTime,
        notificationId: payload.notificationId,
        autoAccept: false,
      });
    } else {
      navigateToIncomingCall(ROUTES.INCOMING_MEAL_CALL, {
        mealSlotId: payload.mealSlotId,
        notificationId: payload.notificationId,
        autoAccept: false,
      });
    }
  };

  return { callBannerPayload, handleBannerExpand };
}
