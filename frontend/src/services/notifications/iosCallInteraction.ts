import { EventType } from '@notifee/react-native';

export type IosCallInteraction = 'open' | 'accept' | 'decline';

/**
 * Maps an iOS notification interaction onto the call action the app should perform.
 *
 * iOS reports a tap on the notification body as PRESS with the implicit action id `default`.
 * That only opens the React incoming-call fallback; explicit Accept is the sole notification
 * interaction that consents to start the voice session.
 */
export function readIosCallInteraction(
  eventType: EventType,
  actionId?: string,
): IosCallInteraction | null {
  if (eventType === EventType.PRESS) {
    return 'open';
  }

  if (eventType !== EventType.ACTION_PRESS) {
    return null;
  }

  if (actionId === 'accept' || actionId === 'decline') {
    return actionId;
  }

  return null;
}

/** Maps the legacy getInitialNotification shape, which has no EventType field. */
export function readInitialIosCallInteraction(
  actionId?: string,
): IosCallInteraction | null {
  if (actionId === undefined || actionId === 'default') {
    return 'open';
  }

  if (actionId === 'accept' || actionId === 'decline') {
    return actionId;
  }

  return null;
}

/** All delivery paths use the same key so foreground/cold-start races collapse to one action. */
export function iosCallInteractionKey(
  notificationId: string | undefined,
  interaction: IosCallInteraction,
): string {
  return `${notificationId ?? 'unknown'}:${interaction}`;
}
