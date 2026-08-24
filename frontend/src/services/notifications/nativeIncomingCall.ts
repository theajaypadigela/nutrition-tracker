/**
 * Typed wrapper over the native `IncomingCall` module shared by Android and iOS. The native side
 * owns the ringing surface (Android full-screen intent / iOS CallKit), while JS:
 *   - hands it a payload to ring (`presentIncomingCall`),
 *   - reads back the user's decision (`consumePendingAnswer` for accepts, `drainCallMarkers` for
 *     declines) when React Native next runs, and
 *   - listens for live actions without relying on React/AppState timing, and
 *   - exposes platform delivery capabilities (Android full-screen intent, iOS PushKit token).
 */

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
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
  consumePendingHangup?: () => Promise<string | null>;
  getVoipToken?: () => Promise<string | null>;
  canUseFullScreenIntent: () => Promise<boolean>;
  openFullScreenIntentSettings: () => void;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
};

/** Terminal result a native marker can carry. */
export type CallResult = 'declined' | 'missed';

const nativeModule: IncomingCallNativeModule | null =
  Platform.OS === 'android' || Platform.OS === 'ios'
    ? ((NativeModules.IncomingCall as IncomingCallNativeModule | undefined) ?? null)
    : null;

export const isNativeIncomingCallAvailable = nativeModule != null;

/** A declined/missed marker the native side persisted for JS to drain. */
export type CallResultMarker = { payload: IncomingCallPayload; result: CallResult };

export type NativeIncomingCallEventResult =
  | 'answered'
  | 'declined'
  | 'missed'
  | 'ended';

export type NativeIncomingCallEvent = {
  result: NativeIncomingCallEventResult;
  callId?: string;
  payload?: IncomingCallPayload;
};

const CALL_EVENT_NAMES: Record<NativeIncomingCallEventResult, string> = {
  answered: 'IncomingCallAnswered',
  declined: 'IncomingCallDeclined',
  missed: 'IncomingCallMissed',
  ended: 'IncomingCallEnded',
};

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
  try {
    nativeModule.presentIncomingCall(buildNativePayloadJson(payload));
    return true;
  } catch {
    return false;
  }
}

/** Tear down the currently-ringing native call (e.g. handled elsewhere). */
export function dismissIncomingCall(): void {
  try {
    nativeModule?.dismissIncomingCall();
  } catch {
    // Native cleanup is best-effort and must not mask voice-session cleanup.
  }
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

/** A native CallKit hang-up that occurred after Answer, atomically consumed for Vapi teardown. */
export async function consumePendingHangup(): Promise<IncomingCallPayload | null> {
  if (!nativeModule?.consumePendingHangup) return null;
  const json = await nativeModule.consumePendingHangup().catch(() => null);
  if (!json) return null;
  try {
    return toIncomingCallPayload(JSON.parse(json));
  } catch {
    return null;
  }
}

/** Current PushKit token, persisted by native before any VoipTokenUpdated event is emitted. */
export async function getVoipToken(): Promise<string | null> {
  if (Platform.OS !== 'ios' || !nativeModule?.getVoipToken) return null;
  const token = await nativeModule.getVoipToken().catch(() => null);
  return typeof token === 'string' && token.length > 0 ? token : null;
}

/** Shared live native-call event subscription. Durable consume methods remain authoritative. */
export function subscribeToNativeIncomingCallEvents(
  listener: (event: NativeIncomingCallEvent) => void,
): () => void {
  if (Platform.OS !== 'ios' || !nativeModule) return () => {};

  let emitter: NativeEventEmitter;
  try {
    emitter = new NativeEventEmitter(nativeModule as any);
  } catch {
    return () => {};
  }

  const subscriptions = (
    Object.entries(CALL_EVENT_NAMES) as [NativeIncomingCallEventResult, string][]
  ).map(([expectedResult, eventName]) =>
    emitter.addListener(eventName, (raw: Record<string, unknown> | undefined) => {
      let payload: IncomingCallPayload | undefined;
      if (typeof raw?.payloadJson === 'string') {
        try {
          payload = toIncomingCallPayload(JSON.parse(raw.payloadJson));
        } catch {
          // The persisted consume/drain path can still recover malformed live events.
        }
      }
      listener({
        result: expectedResult,
        callId: typeof raw?.callId === 'string' ? raw.callId : payload?.callId,
        payload,
      });
    }),
  );

  return () => subscriptions.forEach(subscription => subscription.remove());
}

/** Live PushKit token updates; callers still read getVoipToken() on mount/resume for recovery. */
export function subscribeToVoipTokenUpdates(
  listener: (token: string | null) => void,
): () => void {
  if (Platform.OS !== 'ios' || !nativeModule) return () => {};
  let emitter: NativeEventEmitter;
  try {
    emitter = new NativeEventEmitter(nativeModule as any);
  } catch {
    return () => {};
  }
  const subscription = emitter.addListener(
    'VoipTokenUpdated',
    (raw: { token?: unknown } | undefined) => {
      listener(typeof raw?.token === 'string' && raw.token.length > 0 ? raw.token : null);
    },
  );
  return () => subscription.remove();
}

/** Dedupe key shared by native CallKit actions and notification fallbacks. */
export function nativeCallActionKey(
  payload: IncomingCallPayload,
  action: 'accept' | 'ended',
): string {
  return `${payload.notificationId ?? payload.callId ?? 'unknown'}:${action}`;
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
