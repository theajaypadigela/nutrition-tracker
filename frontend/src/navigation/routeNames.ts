/**
 * Single source of truth for root-stack route names. Use these constants instead of bare
 * string literals so a rename is one edit and typos are caught by the compiler.
 */
export const ROUTES = {
  MAIN_TABS: 'MainTabs',
  INCOMING_MEAL_CALL: 'IncomingMealCall',
  INCOMING_HABIT_CALL: 'IncomingHabitCall',
  MEAL_SCHEDULE: 'MealSchedule',
  ONBOARDING_MEAL_SCHEDULE: 'OnboardingMealSchedule',
  PROFILE: 'Profile',
  REMINDER_HEALTH: 'ReminderHealth',
  VOICE_MEAL_LOG: 'VoiceMealLog',
  VOICE_HABIT: 'VoiceHabit',
} as const;
