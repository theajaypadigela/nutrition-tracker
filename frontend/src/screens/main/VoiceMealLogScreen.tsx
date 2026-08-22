import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { foodLogApi } from '../../services/api/foodLogApi';
import { rescheduleMeal } from '../../services/notifications/reminderService';
import { getTodayLocalDate } from '../../utils/date';
import type { VoiceMealLogParams } from '../../navigation/paramTypes';
import VoiceSessionScreen from '../../components/voice/VoiceSessionScreen';
import { VOICE_LANE_COPY } from '../../components/voice/voiceSessionCopy';
import { buildFollowUpMessage, FOLLOW_UP_INVALID_MESSAGE } from '../../utils/followUp';
import { useVapiSession } from '../../hooks/useVapiSession';

const VOICE_INTERPRET_TIMEOUT_MS = 60000;
const VOICE_PARSE_TIMEOUT_MS = 120000;

export default function VoiceMealLogScreen() {
  const navigation = useNavigation();
  const route =
    useRoute<RouteProp<{ VoiceMealLog: VoiceMealLogParams }, 'VoiceMealLog'>>();
  const { user } = useAuth();
  const mealSlotId: string | undefined = route.params?.mealSlotId;
  const autoStart: boolean = route.params?.autoStart === true;
  const selectedDate = React.useMemo(() => {
    const todayKey = getTodayLocalDate();
    const requestedDate = route.params?.selectedDate;

    if (
      typeof requestedDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ) {
      return todayKey;
    }

    return requestedDate > todayKey ? todayKey : requestedDate;
  }, [route.params?.selectedDate]);

  const mealLabel =
    {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      snack: 'Snack',
      snacks: 'Snacks',
      dinner: 'Dinner',
    }[mealSlotId ?? ''] ?? 'Meals';
  const [entriesLogged, setEntriesLogged] = useState(0);
  const [followUpMessage, setFollowUpMessage] = useState('');
  const isParsingTranscriptRef = useRef(false);
  const lastParsedTranscriptRef = useRef<{ transcript: string; at: number } | null>(null);

  const {
    status,
    setStatus,
    transcript,
    isSpeaking,
    transcriptRef,
    startSession: startVoiceLog,
    stopSession: stopVoiceLog,
  } = useVapiSession({
    purpose: 'meal',
    logTag: 'Vapi',
    permissionDeniedMessage:
      'Microphone access is needed to log meals by voice.',
    getVariableValues: () => ({
      name: user?.name ?? 'User',
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
      startVoiceLog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const getFoodLogSnapshot = useCallback(async (logDate: string) => {
    try {
      const data = await foodLogApi.getLog(logDate);
      const meals = data?.meals || {};
      const items = Object.values(meals).flat() as any[];

      return {
        totalCount: items.length,
        enrichedCount: items.filter((item: any) => item.calories != null).length,
      };
    } catch (err) {
      console.warn('[VoiceMealLog] Could not read food log snapshot:', err);
      return {
        totalCount: 0,
        enrichedCount: 0,
      };
    }
  }, []);

  // Poll for nutrition data to ensure enrichment has completed
  const waitForNutritionEnrichment = useCallback(
    async (
      expectedNewEntries: number,
      logDate: string,
      baseline: { totalCount: number; enrichedCount: number },
    ) => {
      const maxAttempts = 12;
      const delayMs = 1500;
      const targetTotalCount = baseline.totalCount + expectedNewEntries;
      const targetEnrichedCount = baseline.enrichedCount + expectedNewEntries;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          await new Promise<void>(resolve =>
            setTimeout(() => resolve(undefined), delayMs),
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
            `[VoiceMealLog] Waiting for enrichment... attempt ${attempt + 1}/${maxAttempts} ` +
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
      console.log('[VoiceMealLog] Skipping duplicate parse request while one is in progress');
      return;
    }

    const now = Date.now();
    const lastParsed = lastParsedTranscriptRef.current;
    if (
      lastParsed &&
      lastParsed.transcript === fullTranscript &&
      now - lastParsed.at < 120000
    ) {
      console.log('[VoiceMealLog] Skipping duplicate parse for identical transcript within guard window');
      return;
    }

    isParsingTranscriptRef.current = true;

    setStatus('processing');

    try {
      console.log('[VoiceMealLog] Sending transcript to backend for interpretation');
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

        console.log('[VoiceMealLog] Sending transcript to backend for meal logging');
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
      lastParsedTranscriptRef.current = { transcript: fullTranscript, at: Date.now() };
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

  const getStatusText = () => {
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
  };

  return (
    <VoiceSessionScreen
      title={`Logging ${mealLabel}`}
      statusText={getStatusText()}
      status={status}
      isSpeaking={isSpeaking}
      transcript={transcript}
      onPrimaryPress={status === 'active' ? stopVoiceLog : startVoiceLog}
      disablePrimary={status === 'requesting' || status === 'processing'}
      processingText={VOICE_LANE_COPY.meal.processingStrip}
      doneButtonText={VOICE_LANE_COPY.meal.doneButton}
      onDonePress={() =>
        (navigation as any).navigate('MainTabs', { screen: 'Food' })
      }
      onRetryPress={() => setStatus('idle')}
    />
  );
}
