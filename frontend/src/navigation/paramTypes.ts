/**
 * Shared navigation param shapes, reused by RootStackParamList (AppNavigator), the typed
 * navigation helpers (navigationUtils), and the pending-accept hand-off (pendingNavigation),
 * so the same screen's params are defined once.
 */
export type VoiceHabitParams = {
  habitId?: string;
  habitName?: string;
  habitTime?: string;
  autoStart?: boolean;
};

export type VoiceMealLogParams = {
  mealSlotId?: string;
  autoStart?: boolean;
  /** Optional date the in-app mic entry point is logging for (defaults to today). */
  selectedDate?: string;
};
