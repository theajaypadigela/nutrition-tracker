/**
 * Every AsyncStorage key this app owns, in one place.
 *
 * Keys used to be six module-private `STORAGE_KEY` constants plus the string `'token'`
 * inlined at six call sites, which made "what does this app persist?" a grep rather than a
 * question you could answer by reading a file — and made a typo in one of those inline
 * literals a silent logout.
 *
 * **The `_vN` suffix is a schema version, not decoration.** Bumping it strands the old value
 * under the old key instead of mis-parsing it, which is how these stores handle an
 * incompatible shape change. `mealSchedule` is on `_v2` because its shape changed once;
 * everything else is still on its first version. `authToken` is unversioned because it
 * predates the convention and renaming it would sign every installed user out.
 */
export const StorageKeys = {
  /** JWT access token. Read by the API client on every request. */
  authToken: 'token',

  /** Cached habit definitions the reconciliation pass arms triggers from. */
  habitDefinitions: 'habit_definitions_v1',

  /** Cached meal-reminder schedule intent {hour, minute, enabled}. */
  mealSchedule: 'meal_schedule_v2',

  /** Terminal missed-occurrence records, for missed-call follow-ups. */
  missedReminders: 'reminder_missed_v1',

  /** One-shot "call me back in N minutes" reschedules. */
  reminderReschedules: 'reminder_reschedules_v1',

  /** In-flight call markers used to detect an unanswered call after a restart. */
  pendingAnswers: 'reminder_pending_answers_v1',

  /** Exactly-once guard for notification actions across a cold start. */
  processedActions: 'reminder_processed_actions_v1',

  /** One-shot notification-to-navigation hand-off across headless/UI processes. */
  pendingCallNavigation: 'pending_call_navigation_v1',

  /** Whether this install successfully registered its current iOS PushKit token. */
  iosVoipTokenRegistered: 'ios_voip_token_registered_v1',
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];
