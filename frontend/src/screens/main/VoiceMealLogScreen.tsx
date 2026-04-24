import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import Vapi from '@vapi-ai/react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { scheduleMealReschedule } from '../../services/mealScheduler';
import { initializeVapiClient } from '../../services/vapiSessionService';
import { MealVoiceInterpretationResponse } from '../../types/types';
import { getTodayLocalDate } from '../../utils/date';
import VoiceSessionScreen, {
  CallStatus,
} from '../../components/voice/VoiceSessionScreen';

const VOICE_INTERPRET_TIMEOUT_MS = 60000;
const VOICE_PARSE_TIMEOUT_MS = 120000;

function toDebugJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function VoiceMealLogScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { user } = useAuth();
  const mealSlotId: string | undefined = route.params?.mealSlotId;
  const autoStart: boolean = route.params?.autoStart === true;
  const mealLabel =
    {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      snack: 'Snack',
      snacks: 'Snacks',
      dinner: 'Dinner',
    }[mealSlotId ?? ''] ?? 'Meals';
  const [status, setStatus] = useState<CallStatus>('idle');
  const [transcript, setTranscript] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [entriesLogged, setEntriesLogged] = useState(0);
  const [followUpMessage, setFollowUpMessage] = useState('');
  const vapiRef = useRef<Vapi | null>(null);
  const transcriptRef = useRef<string[]>([]);
  const isParsingTranscriptRef = useRef(false);
  const lastParsedTranscriptRef = useRef<{ transcript: string; at: number } | null>(null);
  const lastVapiMessageRef = useRef<any | null>(null);
  const structuredVapiOutputRef = useRef<any | null>(null);

  const disposeVapiInstance = () => {
    const current = vapiRef.current;
    if (!current) {
      return;
    }

    current.removeAllListeners();
    try {
      current.stop();
    } catch {
      // Ignore cleanup errors
    }
    vapiRef.current = null;
  };

  const registerVapiListeners = (vapi: Vapi) => {
    vapi.on('call-start', () => {
      console.log('[Vapi] Call started');
      setStatus('active');
      // Ensure microphone is unmuted when call starts
      try {
        vapi.setMuted(false);
        console.log('[Vapi] Microphone unmuted');
      } catch (e) {
        console.warn('[Vapi] Could not unmute:', e);
      }
    });

    vapi.on('call-end', () => {
      console.log('[Vapi] Call ended');

      if (structuredVapiOutputRef.current) {
        console.log(
          '[Vapi] Structured output captured at call end:',
          toDebugJson(structuredVapiOutputRef.current),
        );
      } else if (lastVapiMessageRef.current) {
        console.log(
          '[Vapi] No explicit structured payload captured. Last Vapi message:',
          toDebugJson(lastVapiMessageRef.current),
        );
      } else {
        console.log('[Vapi] No Vapi messages were captured before call end');
      }

      parseMealsFromTranscript();
    });

    vapi.on('speech-start', () => {
      console.log('[Vapi] Speech started (assistant speaking)');
      setIsSpeaking(true);
    });

    vapi.on('speech-end', () => {
      console.log('[Vapi] Speech ended');
      setIsSpeaking(false);
    });

    vapi.on('error', e => {
      console.error('[Vapi] Error:', e);
      setStatus('error');
    });

    vapi.on('message', (msg: any) => {
      lastVapiMessageRef.current = msg;

      console.log(
        '[Vapi] Message received:',
        msg?.type,
        msg?.role,
        msg?.transcriptType,
      );

      if (
        msg?.type === 'function-call' ||
        msg?.type === 'tool-calls' ||
        msg?.type === 'tool-calls-result' ||
        msg?.message?.type === 'function-call'
      ) {
        structuredVapiOutputRef.current = msg;
        console.log('[Vapi] Structured payload candidate:', toDebugJson(msg));
      }

      if (msg.type === 'transcript' && msg.transcriptType === 'final') {
        const prefix = msg.role === 'assistant' ? 'Assistant: ' : 'You: ';
        const line = `${prefix}${msg.transcript}`;
        setTranscript(prev => [...prev, line]);
        transcriptRef.current = [...transcriptRef.current, line];
      }
    });

    vapi.on('volume-level', (volume: number) => {
      // Log volume level periodically to debug mic input
      if (volume > 0.01) {
        console.log('[Vapi] Volume level:', volume.toFixed(3));
      }
    });
  };

  // Cleanup Vapi instance when leaving the screen.
  useEffect(() => {
    return () => {
      disposeVapiInstance();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-start the VAPI call when navigated from IncomingMealCallScreen accept
  useEffect(() => {
    if (autoStart && status === 'idle') {
      startVoiceLog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    const perm =
      Platform.OS === 'ios'
        ? PERMISSIONS.IOS.MICROPHONE
        : PERMISSIONS.ANDROID.RECORD_AUDIO;
    const result = await check(perm);
    if (result === RESULTS.GRANTED) {
      return true;
    }
    const requested = await request(perm);
    return requested === RESULTS.GRANTED;
  }, []);

  const startVoiceLog = useCallback(async () => {
    setStatus('requesting');
    setTranscript([]);
    transcriptRef.current = [];
    lastVapiMessageRef.current = null;
    structuredVapiOutputRef.current = null;
    setEntriesLogged(0);
    setFollowUpMessage('');

    const hasPermission = await requestMicPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'Microphone access is needed to log meals by voice.',
      );
      setStatus('idle');
      return;
    }

    try {
      disposeVapiInstance();
      const { vapi, assistantId } = await initializeVapiClient('meal');
      registerVapiListeners(vapi);
      vapiRef.current = vapi;

      console.log('[Vapi] Starting call with backend-issued session config');
      await vapi.start(assistantId, {
        variableValues: {
          name: user?.name ?? 'User',
        },
      });
      console.log('[Vapi] Call start initiated');
    } catch (err) {
      console.error('[Vapi] Failed to start voice session:', err);
      Alert.alert('Error', 'Could not start voice session. Please try again.');
      setStatus('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestMicPermission, user?.name]);

  const stopVoiceLog = useCallback(() => {
    const vapi = vapiRef.current;
    if (!vapi) return;

    try {
      console.log('[Vapi] Stopping call');
      vapi.stop();
    } catch (err) {
      console.error('[Vapi] Failed to stop voice session:', err);
    }
  }, []);

  const getFoodLogSnapshot = useCallback(async (logDate: string) => {
    try {
      const response = await apiClient.get(`/food/${logDate}`);
      const meals = response.data?.meals || {};
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
          const res = await apiClient.get(`/food/${logDate}`);
          const meals = res.data?.meals || {};
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
      const interpretation = await apiClient.post<MealVoiceInterpretationResponse>(
        '/food/voice-log/interpret-transcript',
        {
          transcript: fullTranscript,
          mealSlotId,
        },
        {
          timeout: VOICE_INTERPRET_TIMEOUT_MS,
        },
      );

      const shouldLogMeals = interpretation.data?.shouldLogMeals === true;
      const delayMinutes = interpretation.data?.rescheduleMinutes ?? null;

      console.log('[VoiceMealLog] Backend interpretation:', {
        shouldLogMeals,
        rescheduleMinutes: interpretation.data?.rescheduleMinutes,
        rationale: interpretation.data?.rationale,
      });

      let count = 0;
      let duplicateTranscript = false;
      if (shouldLogMeals) {
        const logDate = getTodayLocalDate();
        const baseline = await getFoodLogSnapshot(logDate);

        console.log('[VoiceMealLog] Sending transcript to backend for meal logging');
        const response = await apiClient.post('/food/voice-log/parse-transcript', {
          transcript: fullTranscript,
          logDate,
        }, {
          timeout: VOICE_PARSE_TIMEOUT_MS,
        });
        count = response.data?.entriesLogged ?? 0;
        duplicateTranscript = response.data?.duplicateTranscript === true;

        if (count > 0) {
          console.log('[VoiceMealLog] Waiting for nutrition enrichment...');
          await waitForNutritionEnrichment(count, logDate, baseline);
        }
      }

      setEntriesLogged(count);
      console.log('[VoiceMealLog] Logged', count, 'meal entries');

      if (delayMinutes != null && delayMinutes > 0) {
        const scheduled = await scheduleMealReschedule(delayMinutes);
        if (scheduled) {
          const message =
            count > 0
              ? `Meals logged. Follow-up call scheduled in ${delayMinutes} minute${delayMinutes === 1 ? '' : 's'} (today only).`
              : `Follow-up call scheduled in ${delayMinutes} minute${delayMinutes === 1 ? '' : 's'} (today only).`;
          setFollowUpMessage(message);
          console.log('[VoiceMealLog] Meal follow-up scheduled:', {
            delayMinutes,
          });
        } else {
          const message =
            'Could not schedule follow-up because it would fall on the next day.';
          setFollowUpMessage(message);
          console.log(
            '[VoiceMealLog] Skipped follow-up scheduling due to current-day rule.',
            { delayMinutes },
          );
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
      setFollowUpMessage(
        apiError || 'Something went wrong while processing your meals. Please try again.',
      );
      setStatus('error');
    } finally {
      isParsingTranscriptRef.current = false;
    }
  }, [getFoodLogSnapshot, mealSlotId, waitForNutritionEnrichment]);

  const getStatusText = () => {
    switch (status) {
      case 'idle':
        return 'Tap the microphone to start logging your meals by voice';
      case 'requesting':
        return 'Starting session...';
      case 'active':
        return isSpeaking ? 'Assistant is speaking...' : 'Listening...';
      case 'processing':
        return 'Processing your meals...';
      case 'completed':
        if (followUpMessage) {
          return followUpMessage;
        }

        return entriesLogged > 0
          ? `${entriesLogged} meal${entriesLogged > 1 ? 's' : ''} logged successfully!`
          : 'Call completed';
      case 'error':
        return followUpMessage || 'Something went wrong. Please try again.';
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
      processingText="Analyzing your conversation and logging meals..."
      doneButtonText="Back to Food Log"
      onDonePress={() => navigation.navigate('MainTabs' as never)}
      onRetryPress={() => setStatus('idle')}
    />
  );
}
