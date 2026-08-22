import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { habitApi } from '../../services/api/habitApi';
import { Habit, HabitVoiceResult } from '../../types/types';
import { rescheduleHabit } from '../../services/notifications/reminderService';
import type { VoiceHabitParams } from '../../navigation/paramTypes';
import VoiceSessionScreen from '../../components/voice/VoiceSessionScreen';
import { VOICE_LANE_COPY } from '../../components/voice/voiceSessionCopy';
import { buildFollowUpMessage, FOLLOW_UP_INVALID_MESSAGE } from '../../utils/followUp';
import { useVapiSession } from '../../hooks/useVapiSession';


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

function normalizeHabitStatus(
  status?: string,
): 'completed' | 'rescheduled' | 'not_completed' {
  const normalized = status?.toLowerCase().trim();
  if (normalized === 'completed') return 'completed';
  if (normalized === 'rescheduled') return 'rescheduled';
  return 'not_completed';
}

/** Parse a time string like "2:16 PM" or "02:16PM" into total minutes for comparison. */
function parseTimeToMinutes(t: string): number | null {
  const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const period = m[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function timesMatch(a: string, b: string): boolean {
  // Quick exact match (normalized whitespace)
  const normalize = (t: string) => t.replace(/\s+/g, ' ').trim().toUpperCase();
  if (normalize(a) === normalize(b)) return true;
  // Parse and compare numerically to handle "2:16 PM" vs "02:16 PM"
  const pa = parseTimeToMinutes(a);
  const pb = parseTimeToMinutes(b);
  return pa !== null && pb !== null && pa === pb;
}

export default function VoiceHabitScreen() {
  const navigation = useNavigation();
  const route =
    useRoute<RouteProp<{ VoiceHabit: VoiceHabitParams }, 'VoiceHabit'>>();
  const { user } = useAuth();

  const habitId: string | undefined = route.params?.habitId;
  const habitName: string = route.params?.habitName ?? 'Habit';
  const habitTime: string = route.params?.habitTime ?? '';
  const autoStart: boolean = route.params?.autoStart === true;

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
    startSession: startVoiceCall,
    stopSession: stopVoiceCall,
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
        habits.length > 0
          ? habits.map(h => h.name).join(', ')
          : habitName;

      return {
        name: user?.name ?? 'User',
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
    (async () => {
      try {
        const todayHabits: Habit[] = (await habitApi.getToday()) ?? [];

        console.log('[VapiHabit] Fetched today habits:', JSON.stringify(todayHabits, null, 2));
        console.log('[VapiHabit] Route params -> habitId:', habitId, 'habitTime:', habitTime);

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
        } else if (habitId) {
          // Fallback: use the single habit from route params
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
        } else {
          console.log('[VapiHabit] No matching habits found and no habitId available.');
        }
      } catch (err) {
        console.error('[VapiHabit] Failed to fetch habits:', err);
        // Fallback to single habit from params
        if (habitId) {
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
        }
      }
    })();
  }, [habitId, habitName, habitTime]);

  const displayTitle =
    slotHabits.length > 1
      ? 'Habit Check-in'
      : slotHabits[0]?.name ?? habitName;

  // Auto-start only when we have resolved a concrete habit context.
  useEffect(() => {
    const hasRouteHabitName = habitName.trim().length > 0 && habitName !== 'Habit';
    const hasFetchedHabitName = slotHabits.length > 0;

    if (!autoStart || autoStartTriggeredRef.current || status !== 'idle') {
      return;
    }

    if (!hasRouteHabitName && !hasFetchedHabitName) {
      return;
    }

    autoStartTriggeredRef.current = true;
    startVoiceCall();
  }, [autoStart, status, habitName, slotHabits, startVoiceCall]);

  const navigateToHabits = useCallback(() => {
    (navigation as any).navigate('MainTabs', { screen: 'Habits' });
  }, [navigation]);

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
        // Default to 30 minutes when the user asked to reschedule but didn't specify a time.
        const mins = delayMinutes != null && delayMinutes > 0 ? delayMinutes : 30;

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
          navigateToHabits();
        }, 2000);
      } else {
        setResultMessage(`${habitNames} marked as missed.`);
      }

      setStatus('completed');
    } catch (err) {
      console.error('[VapiHabit] Failed to process result:', err);
      setStatus('error');
    }
  }, [habitTime, navigateToHabits, setStatus, transcriptRef]);

  const getStatusText = () => {
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
  };

  return (
    <VoiceSessionScreen
      title={displayTitle}
      statusText={getStatusText()}
      status={status}
      isSpeaking={isSpeaking}
      transcript={transcript}
      onPrimaryPress={status === 'active' ? stopVoiceCall : startVoiceCall}
      disablePrimary={status === 'requesting' || status === 'processing'}
      processingText={VOICE_LANE_COPY.habit.processingStrip}
      doneButtonText={VOICE_LANE_COPY.habit.doneButton}
      onDonePress={navigateToHabits}
      onRetryPress={() => setStatus('idle')}
    />
  );
}
