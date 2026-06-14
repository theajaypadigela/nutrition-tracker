import { navigationRef } from './navigationRef';
import { ROUTES } from './routeNames';
import type {
  IncomingHabitCallParams,
  IncomingMealCallParams,
  VoiceHabitParams,
  VoiceMealLogParams,
} from './paramTypes';

/**
 * Typed wrappers around the imperative navigationRef. These are the ONLY place that touches
 * navigationRef.navigate/reset, so call sites (App lifecycle, the incoming-call hook) stay
 * fully typed and never cast to `any`. The action objects produced are identical to the
 * previous inline `(navigationRef as any).navigate(...)` calls.
 */

type IncomingCallTarget =
  | typeof ROUTES.INCOMING_MEAL_CALL
  | typeof ROUTES.INCOMING_HABIT_CALL;
type IncomingCallParams = IncomingMealCallParams | IncomingHabitCallParams;

export function navigateToVoiceHabit(params: VoiceHabitParams): void {
  navigationRef.navigate(ROUTES.VOICE_HABIT, params);
}

export function navigateToVoiceMealLog(params: VoiceMealLogParams): void {
  navigationRef.navigate(ROUTES.VOICE_MEAL_LOG, params);
}

export function navigateToIncomingCall(
  target: IncomingCallTarget,
  params: IncomingCallParams,
): void {
  // The (target, params) union can't be correlated by the compiler; the cast is contained
  // here so every caller stays typed.
  (navigationRef.navigate as (name: string, params: object) => void)(
    target,
    params,
  );
}

export function resetToIncomingCall(
  target: IncomingCallTarget,
  params: IncomingCallParams,
): void {
  navigationRef.reset({
    index: 0,
    routes: [{ name: ROUTES.MAIN_TABS }, { name: target, params }],
  } as Parameters<typeof navigationRef.reset>[0]);
}

export function navigateToMainTabs(): void {
  navigationRef.navigate(ROUTES.MAIN_TABS);
}

export function goBackOrMainTabs(): void {
  if (navigationRef.canGoBack()) {
    navigationRef.goBack();
    return;
  }
  navigationRef.navigate(ROUTES.MAIN_TABS);
}
