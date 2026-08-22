import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { foodLogApi } from '../services/api/foodLogApi';
import { rescheduleMeal } from '../services/notifications/reminderService';
import { getTodayLocalDate } from '../utils/date';
import { VOICE_LANE_COPY } from '../components/voice/voiceSessionCopy';
import {
  buildFollowUpMessage,
  FOLLOW_UP_INVALID_MESSAGE,
} from '../utils/followUp';
import { useVapiSession } from './useVapiSession';
import type { CallStatus } from '../components/voice/VoiceSessionScreen';

const VOICE_INTERPRET_TIMEOUT_MS = 60000;
const VOICE_PARSE_TIMEOUT_MS = 120000;

/** Guard window for refusing to re-parse a transcript we already sent. */
const DUPLICATE_PARSE_WINDOW_MS = 120000;

/** How long to wait for the backend to enrich newly-logged entries. */
const ENRICHMENT_MAX_ATTEMPTS = 12;
const ENRICHMENT_DELAY_MS = 1500;

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  snacks: 'Snacks',
  dinner: 'Dinner',
};

export interface UseVoiceMealSessionOptions {
  /** Route param: which meal slot the call is logging against. */
  mealSlotId?: string;
  /** Route param: start the call immediately (arrives from the incoming-call accept). */
  autoStart: boolean;
  /** Route param: the date to log against; future dates clamp to today. */
  selectedDate?: string;
  /** Display name for the caller, used as the assistant's `name` variable. */
  userName?: string;
}

export interface UseVoiceMealSessionResult {
  /** Screen title, e.g. "Logging Breakfast". */
  title: string;
  statusText: string;
  status: CallStatus;
  setStatus: React.Dispatch<React.SetStateAction<CallStatus>>;
  transcript: string[];
  isSpeaking: boolean;
  startSession: () => Promise<void>;
  stopSession: () => void;
}

type LogSnapshot = { totalCount: number; enrichedCount: number };

/**
 * Orchestrates the voice meal-logging lane: Vapi call lifecycle (delegated to
 * useVapiSession), backend interpretation, meal logging, enrichment polling,
 * follow-up rescheduling and status-text derivation.
 *
 * VoiceMealLogScreen renders from this and stays presentation-only, matching the
 * screen/hook split every other screen in the app already follows.
 */
export function useVoiceMealSession(
  options: UseVoiceMealSessionOptions,
): UseVoiceMealSessionResult {
  const { mealSlotId, autoStart, selectedDate: requestedDate, userName } = options;

  const selectedDate = useMemo(() => {
    const todayKey = getTodayLocalDate();

    if (
      typeof requestedDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ) {
      return todayKey;
    }

    return requestedDate > todayKey ? todayKey : requestedDate;
  }, [requestedDate]);

  const mealLabel = MEAL_LABELS[mealSlotId ?? ''] ?? 'Meals';

  const [entriesLogged, setEntriesLogged] = useState(0);
  const [followUpMessage, setFollowUpMessage] = useState('');
  const isParsingTranscriptRef = useRef(false);
  const lastParsedTranscriptRef = useRef<{
    transcript: string;
    at: number;
  } | null>(null);

  const {
    status,
    setStatus,
    transcript,
    isSpeaking,
    transcriptRef,
    startSession,
    stopSession,
  } = useVapiSession({
    purpose: 'meal',
    logTag: 'Vapi',
    permissionDeniedMessage:
      'Microphone access is needed to log meals by voice.',
    getVariableValues: () => ({
      name: userName ?? 'User',
    }),
    onSessionReset: () => {
      setEntriesLogged(0);
      setFollowUpMessage('');
    },
    onCallEnd: () => parseMealsFromTranscript(),
  });

  // Auto-start the VAPI call when navigated from IncomingMealCallScreen accept
  useEffect(() => {
    if (autoStart && status === 'idle') {
      startSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const getFoodLogSnapshot = useCallback(
    async (logDate: string): Promise<LogSnapshot> => {
      try {
        const data = await foodLogApi.getLog(logDate);
        const meals = data?.meals || {};
        const items = Object.values(meals).flat() as any[];

        return {
          totalCount: items.length,
          enrichedCount: items.filter((item: any) => item.calories != null)
            .length,
        };
      } catch (err) {
        console.warn('[VoiceMealLog] Could not read food log snapshot:', err);
        return {
          totalCount: 0,
          enrichedCount: 0,
        };
      }
    },
    [],
  );

  // Poll for nutrition data to ensure enrichment has completed
  const waitForNutritionEnrichment = useCallback(
    async (
      expectedNewEntries: number,
      logDate: string,
      baseline: LogSnapshot,
    ) => {
      const targetTotalCount = baseline.totalCount + expectedNewEntries;
      const targetEnrichedCount = baseline.enrichedCount + expectedNewEntries;

      for (let attempt = 0; attempt < ENRICHMENT_MAX_ATTEMPTS; attempt++) {
        try {
          await new Promise<void>(resolve =>
            setTimeout(() => resolve(undefined), ENRICHMENT_DELAY_MS),
          );
          const res = await foodLogApi.getLog(logDate);
          const meals = res?.meals || {};
          const currentItems = Object.values(meals).flat() as any[];
          const currentTotalCount = currentItems.length;
          const currentEnrichedCount = Object.values(meals)
            .flat()
            .filter((item: any) => item.calories != null).length;

          // Wait for all newly created entries from this session to get nutrition values.
          if (
            currentTotalCount >= targetTotalCount &&
            currentEnrichedCount >= targetEnrichedCount
          ) {
            console.log(
              `[VoiceMealLog] Enrichment completed for ${expectedNewEntries} new entr${expectedNewEntries === 1 ? 'y' : 'ies'} ` +
                `(enriched: ${currentEnrichedCount}/${currentTotalCount})`,
            );
            return;
          }
          console.log(
            `[VoiceMealLog] Waiting for enrichment... attempt ${attempt + 1}/${ENRICHMENT_MAX_ATTEMPTS} ` +
              `(enriched: ${currentEnrichedCount}/${targetEnrichedCount}, total: ${currentTotalCount}/${targetTotalCount})`,
          );
        } catch (err) {
          console.warn('[VoiceMealLog] Error checking nutrition status:', err);
        }
      }
      console.log('[VoiceMealLog] Max wait time reached, proceeding');
    },
    [],
  );

  const parseMealsFromTranscript = useCallback(async () => {
    const conversationLines = transcriptRef.current
      .map(line => line.trim())
      .filter(Boolean);

    if (conversationLines.length === 0) {
      setStatus('completed');
      return;
    }

    const fullTranscript = conversationLines.join('\n').trim();
    if (!fullTranscript) {
      setStatus('completed');
      return;
    }

    if (isParsingTranscriptRef.current) {
      console.log(
        '[VoiceMealLog] Skipping duplicate parse request while one is in progress',
      );
      return;
    }

    const now = Date.now();
    const lastParsed = lastParsedTranscriptRef.current;
    if (
      lastParsed &&
      lastParsed.transcript === fullTranscript &&
      now - lastParsed.at < DUPLICATE_PARSE_WINDOW_MS
    ) {
      console.log(
        '[VoiceMealLog] Skipping duplicate parse for identical transcript within guard window',
      );
      return;
    }

    isParsingTranscriptRef.current = true;

    setStatus('processing');

    try {
      console.log(
        '[VoiceMealLog] Sending transcript to backend for interpretation',
      );
      const interpretation = await foodLogApi.interpretTranscript(
        fullTranscript,
        mealSlotId,
        { timeout: VOICE_INTERPRET_TIMEOUT_MS },
      );

      const shouldLogMeals = interpretation?.shouldLogMeals === true;
      const delayMinutes = interpretation?.rescheduleMinutes ?? null;

      console.log('[VoiceMealLog] Backend interpretation:', {
        shouldLogMeals,
        rescheduleMinutes: interpretation?.rescheduleMinutes,
        rationale: interpretation?.rationale,
      });

      let count = 0;
      let duplicateTranscript = false;
      if (shouldLogMeals) {
        const logDate = selectedDate;
        const baseline = await getFoodLogSnapshot(logDate);

        console.log(
          '[VoiceMealLog] Sending transcript to backend for meal logging',
        );
        const response = await foodLogApi.parseTranscript(
          fullTranscript,
          logDate,
          { timeout: VOICE_PARSE_TIMEOUT_MS },
        );
        count = response?.entriesLogged ?? 0;
        duplicateTranscript = response?.duplicateTranscript === true;

        if (count > 0) {
          console.log('[VoiceMealLog] Waiting for nutrition enrichment...');
          await waitForNutritionEnrichment(count, logDate, baseline);
        }
      }

      setEntriesLogged(count);
      console.log('[VoiceMealLog] Logged', count, 'meal entries');

      if (delayMinutes != null && delayMinutes > 0) {
        const fireAt = await rescheduleMeal(delayMinutes);
        if (fireAt != null) {
          setFollowUpMessage(
            buildFollowUpMessage({
              lead: count > 0 ? 'Meals logged.' : undefined,
              minutes: delayMinutes,
              fireAt,
            }),
          );
          console.log('[VoiceMealLog] Meal follow-up scheduled:', {
            delayMinutes,
            fireAt,
          });
        } else {
          setFollowUpMessage(FOLLOW_UP_INVALID_MESSAGE);
          console.log('[VoiceMealLog] Could not schedule meal follow-up', {
            delayMinutes,
          });
        }
      } else if (duplicateTranscript) {
        setFollowUpMessage(
          'This conversation was already logged recently, so no duplicate meals were added.',
        );
      } else if (count === 0) {
        setFollowUpMessage('No meals were logged in this call.');
      }

      setStatus('completed');
      lastParsedTranscriptRef.current = {
        transcript: fullTranscript,
        at: Date.now(),
      };
    } catch (err) {
      console.error('[VoiceMealLog] Failed to parse transcript:', err);
      const apiError =
        typeof (err as any)?.response?.data?.error === 'string'
          ? (err as any).response.data.error.trim()
          : '';
      setFollowUpMessage(apiError || VOICE_LANE_COPY.meal.genericError);
      setStatus('error');
    } finally {
      isParsingTranscriptRef.current = false;
    }
  }, [
    getFoodLogSnapshot,
    mealSlotId,
    selectedDate,
    setStatus,
    transcriptRef,
    waitForNutritionEnrichment,
  ]);

  const statusText = (() => {
    switch (status) {
      case 'idle':
        return VOICE_LANE_COPY.meal.idle;
      case 'requesting':
        return 'Starting session...';
      case 'active':
        return isSpeaking ? 'Assistant is speaking...' : 'Listening...';
      case 'processing':
        return VOICE_LANE_COPY.meal.processingStatus;
      case 'completed':
        if (followUpMessage) {
          return followUpMessage;
        }

        return entriesLogged > 0
          ? `${entriesLogged} meal${entriesLogged > 1 ? 's' : ''} logged successfully!`
          : 'Call completed';
      case 'error':
        return followUpMessage || VOICE_LANE_COPY.meal.genericError;
      default:
        return '';
    }
  })();

  return {
    title: `Logging ${mealLabel}`,
    statusText,
    status,
    setStatus,
    transcript,
    isSpeaking,
    startSession,
    stopSession,
  };
}
