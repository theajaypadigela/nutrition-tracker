import { navigationRef } from './navigationRef';
import { ROUTES } from './routeNames';
import type { VoiceHabitParams, VoiceMealLogParams } from './paramTypes';

/**
 * Typed wrappers around the imperative navigationRef. These are the ONLY place that touches
 * navigationRef.navigate/reset, so call sites (App lifecycle, the accepted-call hook) stay
 * fully typed and never cast to `any`.
 */

export function navigateToVoiceHabit(params: VoiceHabitParams): void {
  navigationRef.navigate(ROUTES.VOICE_HABIT, params);
}

export function navigateToVoiceMealLog(params: VoiceMealLogParams): void {
  navigationRef.navigate(ROUTES.VOICE_MEAL_LOG, params);
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
