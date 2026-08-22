import { useCallback, useEffect, useRef, useState } from 'react';
import { habitApi } from '../services/api/habitApi';
import { Habit, HabitVoiceResult } from '../types/types';
import { rescheduleHabit } from '../services/notifications/reminderService';
import { VOICE_LANE_COPY } from '../components/voice/voiceSessionCopy';
import {
  buildFollowUpMessage,
  FOLLOW_UP_INVALID_MESSAGE,
} from '../utils/followUp';
import { timesMatch } from '../utils/timeFormatter';
import { useVapiSession } from './useVapiSession';
import type { CallStatus } from '../components/voice/VoiceSessionScreen';

/** Minutes to reschedule by when the user asked to defer but named no delay. */
const DEFAULT_RESCHEDULE_MINUTES = 30;

/** Grace period before bouncing back to the habit list after a reschedule. */
const POST_RESCHEDULE_NAVIGATE_DELAY_MS = 2000;

function normalizeHabitStatus(
  status?: string,
): 'completed' | 'rescheduled' | 'not_completed' {
  const normalized = status?.toLowerCase().trim();
  if (normalized === 'completed') return 'completed';
  if (normalized === 'rescheduled') return 'rescheduled';
  return 'not_completed';
}

/** Uses backend Gemini interpretation to infer completion/reschedule intent. */
async function interpretVoiceTranscriptWithBackend(
  transcriptLines: string[],
  habitName: string,
  habitTime: string,
): Promise<HabitVoiceResult | null> {
  if (transcriptLines.length === 0) return null;

  const interpreted = await habitApi.interpretVoice(
    transcriptLines,
    habitName,
    habitTime,
  );
  const status = normalizeHabitStatus(interpreted?.habitStatus);
  if (status === 'not_completed') {
    return {
      habit_name: habitName,
      habit_status: 'not_completed',
    };
  }

  return {
    habit_name: habitName,
    habit_status: status,
    reschedule_minutes: interpreted?.rescheduleMinutes ?? null,
  };
}

export interface UseVoiceHabitSessionOptions {
  /** Route param: the habit that rang, used as the fallback when the fetch finds none. */
  habitId?: string;
  /** Route param: habit name; '' or 'Habit' both mean "unresolved". */
  habitName: string;
  /** Route param: the slot's reminder time, e.g. "08:30 AM". */
  habitTime: string;
  /** Route param: start the call immediately (arrives from the incoming-call accept). */
  autoStart: boolean;
  /** Display name for the caller, used as the assistant's `name` variable. */
  userName?: string;
  /**
   * Called ~2s after a successful reschedule so the caller can return to the habit
   * list, where the rescheduled habit is now visible. Navigation stays with the screen.
   */
  onRescheduled: () => void;
}

export interface UseVoiceHabitSessionResult {
  /** Screen title: the single habit's name, or "Habit Check-in" for a multi-habit slot. */
  title: string;
  statusText: string;
  status: CallStatus;
  setStatus: React.Dispatch<React.SetStateAction<CallStatus>>;
  transcript: string[];
  isSpeaking: boolean;
  startSession: () => Promise<void>;
  stopSession: () => void;
}

/**
 * Orchestrates the voice habit check-in lane: resolves every pending call-type habit
 * sharing the rung time slot, runs the Vapi call (delegated to useVapiSession),
 * interprets the transcript on the backend, applies the result to the whole slot,
 * arms one consolidated follow-up call and derives the status text.
 *
 * VoiceHabitScreen renders from this and stays presentation-only, matching the
 * screen/hook split every other screen in the app already follows.
 */
export function useVoiceHabitSession(
  options: UseVoiceHabitSessionOptions,
): UseVoiceHabitSessionResult {
  const { habitId, habitName, habitTime, autoStart, userName, onRescheduled } =
    options;

  const [resultMessage, setResultMessage] = useState('');

  // All pending habits for this time slot (fetched from backend)
  const [slotHabits, setSlotHabits] = useState<Habit[]>([]);
  const slotHabitsRef = useRef<Habit[]>([]);
  const autoStartTriggeredRef = useRef(false);

  const {
    status,
    setStatus,
    transcript,
    isSpeaking,
    transcriptRef,
    startSession,
    stopSession,
  } = useVapiSession({
    purpose: 'habit',
    logTag: 'VapiHabit',
    permissionDeniedMessage:
      'Microphone access is needed for your habit check-in by voice.',
    getVariableValues: () => {
      // Build a primary habit name plus full list for multi-habit calls
      const habits = slotHabitsRef.current;
      const primaryHabitName =
        habits[0]?.name ?? (habitName.trim().length > 0 ? habitName : 'Habit');
      const allHabitNames =
        habits.length > 0 ? habits.map(h => h.name).join(', ') : habitName;

      return {
        name: userName ?? 'User',
        habit: primaryHabitName,
        habit_name: primaryHabitName,
        habits: allHabitNames,
        habit_time: habitTime,
      };
    },
    onSessionReset: () => setResultMessage(''),
    onCallEnd: () => processHabitResult(),
  });

  // Fetch all pending habits for the time slot
  useEffect(() => {
    const fallbackToRouteHabit = () => {
      if (!habitId) {
        return false;
      }
      const fallback: Habit = {
        id: habitId,
        name: habitName,
        reminderTime: habitTime,
        reminderType: 'call',
        completed: false,
        repeatDays: [],
      };
      setSlotHabits([fallback]);
      slotHabitsRef.current = [fallback];
      return true;
    };

    (async () => {
      try {
        const todayHabits: Habit[] = (await habitApi.getToday()) ?? [];

        console.log(
          '[VapiHabit] Fetched today habits:',
          JSON.stringify(todayHabits, null, 2),
        );
        console.log(
          '[VapiHabit] Route params -> habitId:',
          habitId,
          'habitTime:',
          habitTime,
        );

        // Filter for call-type habits at the same time that are still pending
        const pending = todayHabits.filter(
          h =>
            timesMatch(h.reminderTime, habitTime) &&
            h.reminderType === 'call' &&
            h.status !== 'COMPLETED',
        );

        console.log('[VapiHabit] Matched pending habits by time:', pending.length);

        if (pending.length > 0) {
          setSlotHabits(pending);
          slotHabitsRef.current = pending;
        } else if (!fallbackToRouteHabit()) {
          console.log(
            '[VapiHabit] No matching habits found and no habitId available.',
          );
        }
      } catch (err) {
        console.error('[VapiHabit] Failed to fetch habits:', err);
        // Fallback to single habit from params
        fallbackToRouteHabit();
      }
    })();
  }, [habitId, habitName, habitTime]);

  // Auto-start only when we have resolved a concrete habit context.
  useEffect(() => {
    const hasRouteHabitName =
      habitName.trim().length > 0 && habitName !== 'Habit';
    const hasFetchedHabitName = slotHabits.length > 0;

    if (!autoStart || autoStartTriggeredRef.current || status !== 'idle') {
      return;
    }

    if (!hasRouteHabitName && !hasFetchedHabitName) {
      return;
    }

    autoStartTriggeredRef.current = true;
    startSession();
  }, [autoStart, status, habitName, slotHabits, startSession]);

  const processHabitResult = useCallback(async () => {
    setStatus('processing');

    const habits = slotHabitsRef.current;

    if (habits.length === 0) {
      setResultMessage('Call completed');
      setStatus('completed');
      return;
    }

    let result: HabitVoiceResult | null = null;

    try {
      result = await interpretVoiceTranscriptWithBackend(
        transcriptRef.current,
        habits.map(h => h.name).join(', '),
        habitTime,
      );
    } catch (err) {
      console.error('[VapiHabit] Backend transcript interpretation failed:', err);
    }

    if (!result) {
      setResultMessage('Call completed');
      setStatus('completed');
      return;
    }

    const habitStatus = normalizeHabitStatus(result.habit_status);
    const delayMinutes = result.reschedule_minutes ?? null;

    try {
      // Apply the voice result to ALL habits in the time slot
      for (const habit of habits) {
        try {
          await habitApi.submitVoiceResult({
            habitId: habit.id,
            habitName: habit.name,
            habitStatus,
            rescheduleMinutes: delayMinutes,
            completedAt: result.completed_at,
          });
        } catch (err) {
          console.error(
            `[VapiHabit] Failed to process habit "${habit.name}":`,
            err,
          );
        }
      }

      const habitNames = habits.map(h => `"${h.name}"`).join(', ');

      if (habitStatus === 'completed') {
        setResultMessage(`${habitNames} marked as completed!`);
      } else if (habitStatus === 'rescheduled') {
        // Default when the user asked to reschedule but didn't specify a time.
        const mins =
          delayMinutes != null && delayMinutes > 0
            ? delayMinutes
            : DEFAULT_RESCHEDULE_MINUTES;

        // Schedule ONE consolidated follow-up call across all habits in this time slot,
        // then build the confirmation from the epoch the scheduler actually armed.
        let fireAt: number | null = null;
        if (habits.length > 0) {
          fireAt = await rescheduleHabit(
            {
              id: habits[0].id,
              name: habits.map(h => h.name).join(', '),
              reminderTime: habitTime,
              reminderType: 'call',
              completed: false,
              repeatDays: [],
            },
            mins,
          );
        }

        if (fireAt == null) {
          setResultMessage(FOLLOW_UP_INVALID_MESSAGE);
        } else {
          setResultMessage(
            buildFollowUpMessage({
              lead: `${habitNames} rescheduled.`,
              minutes: mins,
              fireAt,
            }),
          );
        }

        // Auto-navigate back so the rescheduled habit immediately appears on screen
        setTimeout(() => {
          onRescheduled();
        }, POST_RESCHEDULE_NAVIGATE_DELAY_MS);
      } else {
        setResultMessage(`${habitNames} marked as missed.`);
      }

      setStatus('completed');
    } catch (err) {
      console.error('[VapiHabit] Failed to process result:', err);
      setStatus('error');
    }
  }, [habitTime, onRescheduled, setStatus, transcriptRef]);

  const statusText = (() => {
    switch (status) {
      case 'idle':
        return VOICE_LANE_COPY.habit.idle;
      case 'requesting':
        return 'Starting session...';
      case 'active':
        return isSpeaking ? 'Assistant is speaking...' : 'Listening...';
      case 'processing':
        return VOICE_LANE_COPY.habit.processingStatus;
      case 'completed':
        return resultMessage || 'Call completed';
      case 'error':
        return VOICE_LANE_COPY.habit.genericError;
      default:
        return '';
    }
  })();

  return {
    title:
      slotHabits.length > 1
        ? 'Habit Check-in'
        : slotHabits[0]?.name ?? habitName,
    statusText,
    status,
    setStatus,
    transcript,
    isSpeaking,
    startSession,
    stopSession,
  };
}
