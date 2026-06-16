/**
 * Single source of truth for the AI assistant's identity across EVERY call/notification
 * surface — the OS notification, the incoming-call banner, the full-screen incoming call,
 * and the in-call session header.
 *
 * Before this module the assistant was named three different things during one call
 * ("AI Nutrition Assistant"/"AI Habit Assistant" in the notification, "AI Agent" on the
 * call screen, "AI Assistant" in-call). The unified rule is: ONE name everywhere, with a
 * small Meals/Habits context tag where a surface benefits from disambiguation.
 */

export type CallContext = 'meal' | 'habit';

/** The one name shown on every surface. */
export const ASSISTANT_NAME = 'AI Assistant';

/** The "AI • Verified" trust pill copy, shared by the banner and full-screen call. */
export const ASSISTANT_VERIFIED_LABEL = 'AI • Verified';

/**
 * Short context tag (the only thing that differs between the two reminder families on a
 * given surface). Kept as a noun ("Meals"/"Habits") rather than "Meal assistant" so it
 * reads as a tag next to the shared assistant name, not a second name.
 */
export function assistantContextLabel(context: CallContext): string {
  return context === 'habit' ? 'Habits' : 'Meals';
}

/**
 * Notification tray title. Unified to the single assistant name for both reminder
 * families; the context lives in the body so the title never reintroduces a per-family
 * name. (habit-push, a non-call reminder, keeps its own descriptive title — see
 * notificationBuilder.)
 */
export function callNotificationTitle(_context: CallContext): string {
  return ASSISTANT_NAME;
}
