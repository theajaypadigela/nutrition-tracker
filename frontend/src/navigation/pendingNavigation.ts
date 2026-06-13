/**
 * Cross-handler hand-off for a pending "Accept" navigation. The background event handler
 * (which may run before the UI is ready) records where to navigate; App's AppState
 * listener consumes it when the app becomes active. Module-level state is shared across
 * the single RN JS context (foreground + headless), which is exactly this case.
 */

export type PendingAcceptNavigation = {
  screen: 'VoiceHabit' | 'VoiceMealLog';
  mealSlotId?: string;
  habitId?: string;
  habitName?: string;
  habitTime?: string;
};

let pending: PendingAcceptNavigation | null = null;

export function setPendingAcceptNavigation(next: PendingAcceptNavigation | null): void {
  pending = next;
}

export function takePendingAcceptNavigation(): PendingAcceptNavigation | null {
  const value = pending;
  pending = null;
  return value;
}
