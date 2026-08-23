/**
 * Typed wrapper over the native `IncomingCall` module (Android). The native side draws the
 * full-screen call screen (a CallStyle + full-screen-intent notification → IncomingCallActivity),
 * so JS only:
 *   - hands it a payload to ring (`presentIncomingCall`),
 *   - reads back the user's decision (`consumePendingAnswer` for accepts, `drainCallMarkers` for
 *     declines) when React Native next runs, and
 *   - exposes the Android 14+ full-screen-intent permission state for the health surface.
 *
 * On iOS the module is absent and every call here is a safe no-op (iOS true-call is out of scope).
 */

import { NativeModules, Platform } from 'react-native';
import {
  ASSISTANT_NAME,
  ASSISTANT_VERIFIED_LABEL,
  assistantContextLabel,
} from '@/config/assistant';
import type { IncomingCallPayload } from '@/hooks/useIncomingCall';

type IncomingCallNativeModule = {
  presentIncomingCall: (payloadJson: string) => void;
  dismissIncomingCall: () => void;
  consumePendingAnswer: () => Promise<string | null>;
  drainCallMarkers: () => Promise<string>;
  consumePendingMissedAction: () => Promise<string | null>;
  canUseFullScreenIntent: () => Promise<boolean>;
  openFullScreenIntentSettings: () => void;
};

/** Terminal result a native marker can carry. */
export type CallResult = 'declined' | 'missed';

const nativeModule: IncomingCallNativeModule | null =
  Platform.OS === 'android'
    ? ((NativeModules.IncomingCall as IncomingCallNativeModule | undefined) ?? null)
    : null;

export const isNativeIncomingCallAvailable = nativeModule != null;

/** A declined/missed marker the native side persisted for JS to drain. */
export type CallResultMarker = { payload: IncomingCallPayload; result: CallResult };

function buildNativePayloadJson(payload: IncomingCallPayload): string {
  const kind = payload.reminderKind ?? (payload.type === 'meal' ? 'meal-call' : 'habit-call');
  return JSON.stringify({
    ...payload,
    // Identity + display fields the native call screen renders directly:
    callId: payload.callId ?? payload.notificationId ?? `${payload.type}-call`,
    kind,
    assistantName: ASSISTANT_NAME,
    subtitle: assistantContextLabel(payload.type),
    verifiedLabel: ASSISTANT_VERIFIED_LABEL,
  });
}

/** Maps the JSON the native side relays back into the JS call payload shape. */
function toIncomingCallPayload(raw: Record<string, any>): IncomingCallPayload {
  const type: IncomingCallPayload['type'] =
    raw.type === 'meal' || raw.type === 'habit'
      ? raw.type
      : raw.kind === 'meal-call'
        ? 'meal'
        : 'habit';
  return {
    type,
    callId: raw.callId,
    notificationId: raw.notificationId,
    mealSlotId: raw.mealSlotId,
    habitId: raw.habitId,
    habitName: raw.habitName,
    habitTime: raw.habitTime,
    intendedFireAt: raw.intendedFireAt ?? null,
    slotKey: raw.slotKey,
    reminderKind: raw.reminderKind ?? raw.kind,
    isRescheduled: raw.isRescheduled ?? false,
  };
}

/** Ring the native incoming-call screen. Returns false when the native module is unavailable. */
export function presentIncomingCall(payload: IncomingCallPayload): boolean {
  if (!nativeModule) return false;
  nativeModule.presentIncomingCall(buildNativePayloadJson(payload));
  return true;
}

/** Tear down the currently-ringing native call (e.g. handled elsewhere). */
export function dismissIncomingCall(): void {
  nativeModule?.dismissIncomingCall();
}

/** The call the user ACCEPTED (and clears it), or null. Drives navigation into the session. */
export async function consumePendingAnswer(): Promise<IncomingCallPayload | null> {
  if (!nativeModule) return null;
  const json = await nativeModule.consumePendingAnswer().catch(() => null);
  if (!json) return null;
  try {
    return toIncomingCallPayload(JSON.parse(json));
  } catch {
    return null;
  }
}

/**
 * Drains terminal call markers (declined / missed) the native side persisted while the app was
 * away, and clears them. The reconciliation pass reports each to the server (and, for misses,
 * dedupes the already-shown native follow-up).
 */
export async function drainCallResults(): Promise<CallResultMarker[]> {
  if (!nativeModule) return [];
  const json = await nativeModule.drainCallMarkers().catch(() => '[]');
  let parsed: unknown;
  try {
    parsed = JSON.parse(json || '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(
      (m): m is Record<string, any> =>
        !!m && (m.result === 'declined' || m.result === 'missed'),
    )
    .map(m => ({
      payload: toIncomingCallPayload(m),
      result: m.result as CallResult,
    }));
}

/**
 * The missed-call follow-up the user tapped "Log now" on (and clears it), or null. Drives
 * navigation into the voice log for that occurrence.
 */
export async function consumePendingMissedAction(): Promise<IncomingCallPayload | null> {
  if (!nativeModule) return null;
  const json = await nativeModule.consumePendingMissedAction().catch(() => null);
  if (!json) return null;
  try {
    return toIncomingCallPayload(JSON.parse(json));
  } catch {
    return null;
  }
}

/** Android 14+: whether the app may launch a full-screen call over the lockscreen. */
export async function canUseFullScreenIntent(): Promise<boolean> {
  if (!nativeModule) return true;
  return nativeModule.canUseFullScreenIntent().catch(() => true);
}

/** Opens the per-app "Manage full screen intents" settings page (Android 14+). */
export function openFullScreenIntentSettings(): void {
  nativeModule?.openFullScreenIntentSettings();
}
