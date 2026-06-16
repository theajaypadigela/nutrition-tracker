/**
 * Per-lane copy for the in-call voice session, centralized so VoiceMealLogScreen and
 * VoiceHabitScreen stop drifting independently. Only the lane-specific static strings live
 * here; the shared, status-driven labels (Connecting…/Listening…/Speaking…, "Start Call",
 * "End Call", "Try Again") stay in the shared VoiceSessionScreen component, and dynamic
 * result/follow-up text is built per-call from utils/followUp.
 */

export type VoiceLane = 'meal' | 'habit';

export interface VoiceLaneCopy {
  /** statusText subtitle in the idle state (the screen's primary action is "Start Call"). */
  idle: string;
  /** statusText subtitle while the post-call processing runs. */
  processingStatus: string;
  /** Activity-indicator strip text shown only during processing. */
  processingStrip: string;
  /** Secondary button label shown when the call completes. */
  doneButton: string;
  /** Fallback error message when no backend-specific error is available. */
  genericError: string;
}

export const VOICE_LANE_COPY: Record<VoiceLane, VoiceLaneCopy> = {
  meal: {
    idle: 'Tap Start Call to log your meals by voice',
    processingStatus: 'Processing your meals…',
    processingStrip: 'Analyzing your conversation and logging meals…',
    doneButton: 'Back to Food Log',
    genericError:
      'Something went wrong while processing your meals. Please try again.',
  },
  habit: {
    idle: 'Tap Start Call to begin your habit check-in',
    processingStatus: 'Processing your response…',
    processingStrip: 'Processing your habit check-in…',
    doneButton: 'Back to Habits',
    genericError: 'Something went wrong. Please try again.',
  },
};
