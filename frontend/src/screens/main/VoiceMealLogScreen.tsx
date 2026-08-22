import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import Vapi from '@vapi-ai/react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { formatLocalDate } from '../../shared/date-time/localDate';
import { scheduleMealReschedule } from '../../services/mealScheduler';
import VoiceSessionScreen, {
  CallStatus,
} from '../../components/voice/VoiceSessionScreen';
import { foodLogApi } from '../../features/food-log/api/foodLogApi';
import { voiceApi } from '../../features/voice/api/voiceApi';
import { getVapiConfiguration } from '../../config/buildConfig';
import {
  finishVoiceSession,
  waitForVoiceCallEnd,
} from '../../services/voiceSessionLifecycle';
import { getEnrichmentPresentation } from '../../features/food-log/enrichmentStatus';

type VoiceMealLogRoute = RouteProp<
  {
    VoiceMealLog: { mealSlotId?: string; autoStart?: boolean } | undefined;
  },
  'VoiceMealLog'
>;

interface VoiceMealFunctionParameters {
  reschedule_minutes?: number | string;
  delay_minutes?: number | string;
  delayMinutes?: number | string;
}

interface VoiceMealMessage {
  type?: string;
  role?: string;
  transcriptType?: string;
  transcript?: string;
  functionCall?: {
    parameters?: VoiceMealFunctionParameters;
  };
}

function extractDelayFromText(text: string): number | null {
  const lowered = text.toLowerCase();
  const delayPatterns = [
    /(?:call|remind|ping|check(?:\s+in)?)\s+me\s+(?:again\s+)?(?:in|after)\s+(\d{1,3})\s*(?:minutes?|mins?|m)\b/i,
    /(?:in|after)\s+(\d{1,3})\s*(?:minutes?|mins?|m)\b/i,
  ];

  for (const pattern of delayPatterns) {
    const match = lowered.match(pattern);
    if (!match) continue;
    const parsed = parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function extractDelayMinutes(lines: string[]): number | null {
  for (const line of lines) {
    if (!line.startsWith('You:')) continue;
    const minutes = extractDelayFromText(line);
    if (minutes != null) {
      return minutes;
    }
  }

  for (const line of lines) {
    const minutes = extractDelayFromText(line);
    if (minutes != null) {
      return minutes;
    }
  }

  return null;
}

export default function VoiceMealLogScreen() {
  const navigation = useNavigation();
  const route = useRoute<VoiceMealLogRoute>();
  const { user } = useAuth();
  const mealSlotId: string | undefined = route.params?.mealSlotId;
  const autoStart: boolean = route.params?.autoStart === true;
  const mealLabel =
    {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
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
  const delayMinutesRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const vapiAssistantIdRef = useRef<string | null>(null);
  const persistCapturedResultRef = useRef<() => Promise<void>>(
    async () => undefined,
  );
  const finalizationPromiseRef = useRef<Promise<void> | null>(null);
  const callEndPromiseRef = useRef<Promise<void>>(Promise.resolve());
  const resolveCallEndRef = useRef<(() => void) | null>(null);

  const finalizeCapturedResult = useCallback((): Promise<void> => {
    if (!finalizationPromiseRef.current) {
      finalizationPromiseRef.current = persistCapturedResultRef.current();
    }
    return finalizationPromiseRef.current;
  }, []);

  // Wire up Vapi events
  useEffect(() => {
    isMountedRef.current = true;

    let vapiConfiguration: ReturnType<typeof getVapiConfiguration>;
    try {
      vapiConfiguration = getVapiConfiguration('meal');
    } catch (error) {
      console.error('[Vapi] Build configuration error:', error);
      setStatus('error');
      return () => {
        isMountedRef.current = false;
      };
    }

    // Create a fresh Vapi instance for this screen
    const vapi = new Vapi(vapiConfiguration.publicKey);
    vapiRef.current = vapi;
    vapiAssistantIdRef.current = vapiConfiguration.assistantId;

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
      resolveCallEndRef.current?.();
      resolveCallEndRef.current = null;
      finalizeCapturedResult().catch(error => {
        console.error('[Vapi] Failed to persist call transcript:', error);
      });
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

    vapi.on('message', (msg: VoiceMealMessage) => {
      console.log(
        '[Vapi] Message received:',
        msg?.type,
        msg?.role,
        msg?.transcriptType,
      );
      if (msg.type === 'transcript' && msg.transcriptType === 'final') {
        const prefix = msg.role === 'assistant' ? 'Assistant: ' : 'You: ';
        const line = `${prefix}${msg.transcript}`;
        setTranscript(prev => [...prev, line]);
        transcriptRef.current = [...transcriptRef.current, line];
      }

      if (msg.type === 'function-call' && msg.functionCall?.parameters) {
        const params = msg.functionCall.parameters;
        const directMinutes =
          params?.reschedule_minutes ??
          params?.delay_minutes ??
          params?.delayMinutes;

        if (typeof directMinutes === 'number' && directMinutes > 0) {
          delayMinutesRef.current = Math.floor(directMinutes);
          console.log(
            '[VoiceMealLog] Captured delay from structured response:',
            delayMinutesRef.current,
          );
        } else if (typeof directMinutes === 'string') {
          const parsed = parseInt(directMinutes, 10);
          if (Number.isFinite(parsed) && parsed > 0) {
            delayMinutesRef.current = parsed;
            console.log(
              '[VoiceMealLog] Captured delay from structured string response:',
              delayMinutesRef.current,
            );
          }
        }
      }
    });

    vapi.on('volume-level', (volume: number) => {
      // Log volume level periodically to debug mic input
      if (volume > 0.01) {
        console.log('[Vapi] Volume level:', volume.toFixed(3));
      }
    });

    return () => {
      isMountedRef.current = false;
      vapiRef.current = null;
      vapiAssistantIdRef.current = null;
      finishVoiceSession(vapi, finalizeCapturedResult, () =>
        waitForVoiceCallEnd(callEndPromiseRef.current),
      ).catch(error => {
        console.warn('[Vapi] Voice session teardown failed:', error);
      });
    };
  }, [finalizeCapturedResult]);

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
    setEntriesLogged(0);
    setFollowUpMessage('');
    delayMinutesRef.current = null;
    finalizationPromiseRef.current = null;
    callEndPromiseRef.current = new Promise(resolve => {
      resolveCallEndRef.current = resolve;
    });

    const hasPermission = await requestMicPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'Microphone access is needed to log meals by voice.',
      );
      setStatus('idle');
      return;
    }

    const vapi = vapiRef.current;
    if (!vapi) {
      console.error('[Vapi] No Vapi instance available');
      setStatus('error');
      return;
    }

    const assistantId = vapiAssistantIdRef.current;
    if (!assistantId) {
      console.error('[Vapi] Meal assistant configuration is unavailable');
      setStatus('error');
      return;
    }

    try {
      console.log('[Vapi] Starting configured meal assistant call');
      await vapi.start(assistantId, {
        metadata: { userId: user?.id ?? '' },
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
  }, [requestMicPermission, user?.id]);

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

  // Poll for nutrition data to ensure enrichment has completed
  const waitForNutritionEnrichment = useCallback(
    async (expectedNewEntries: number) => {
      const today = formatLocalDate();
      const maxAttempts = 12;
      const delayMs = 1500;

      // Track baseline counts so we only wait for entries from this voice session.
      let initialEnrichedCount = 0;
      let initialTotalCount = 0;
      try {
        const initialResponse = await foodLogApi.getForDate(today);
        const meals = initialResponse.meals || {};
        const initialItems = Object.values(meals).flat();
        initialTotalCount = initialItems.length;
        initialEnrichedCount = Object.values(meals)
          .flat()
          .filter(item =>
            item.enrichmentStatus
              ? getEnrichmentPresentation(item.enrichmentStatus).isTerminal
              : item.calories != null,
          ).length;
      } catch {
        // Ignore initial check errors
      }

      const targetTotalCount = initialTotalCount + expectedNewEntries;
      const targetEnrichedCount = initialEnrichedCount + expectedNewEntries;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          const response = await foodLogApi.getForDate(today);
          const meals = response.meals || {};
          const currentItems = Object.values(meals).flat();
          const currentTotalCount = currentItems.length;
          const currentEnrichedCount = Object.values(meals)
            .flat()
            .filter(item =>
              item.enrichmentStatus
                ? getEnrichmentPresentation(item.enrichmentStatus).isTerminal
                : item.calories != null,
            ).length;

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
    const lines = transcriptRef.current;
    if (lines.length === 0) {
      if (isMountedRef.current) setStatus('completed');
      return;
    }

    if (isMountedRef.current) setStatus('processing');
    const transcriptDelay = extractDelayMinutes(lines);
    const delayMinutes = delayMinutesRef.current ?? transcriptDelay;

    console.log('[VoiceMealLog] Delay detection:', {
      structuredDelay: delayMinutesRef.current,
      transcriptDelay,
      finalDelay: delayMinutes,
    });

    try {
      const fullTranscript = lines.join('\n');
      console.log('[VoiceMealLog] Sending transcript to backend for parsing');
      const response = await voiceApi.parseMealTranscript({
        transcript: fullTranscript,
      });
      const count = response.entriesLogged ?? 0;
      if (isMountedRef.current) setEntriesLogged(count);
      console.log('[VoiceMealLog] Logged', count, 'meal entries');

      // Wait for nutrition enrichment to complete (poll for a few seconds)
      if (count > 0 && isMountedRef.current) {
        console.log('[VoiceMealLog] Waiting for nutrition enrichment...');
        await waitForNutritionEnrichment(count);
      }

      if (delayMinutes != null && delayMinutes > 0) {
        const scheduled = user?.id
          ? await scheduleMealReschedule(delayMinutes, user.id)
          : false;
        if (scheduled) {
          const message = `Follow-up call scheduled in ${delayMinutes} minute${delayMinutes === 1 ? '' : 's'} (today only).`;
          if (isMountedRef.current) setFollowUpMessage(message);
          console.log('[VoiceMealLog] Meal follow-up scheduled:', {
            delayMinutes,
          });
        } else {
          const message =
            'Could not schedule follow-up because it would fall on the next day.';
          if (isMountedRef.current) setFollowUpMessage(message);
          console.log(
            '[VoiceMealLog] Skipped follow-up scheduling due to current-day rule.',
            { delayMinutes },
          );
        }
      }

      if (isMountedRef.current) setStatus('completed');
    } catch (err) {
      console.error('[VoiceMealLog] Failed to parse transcript:', err);
      if (isMountedRef.current) setStatus('error');
    }
  }, [user?.id, waitForNutritionEnrichment]);

  persistCapturedResultRef.current = parseMealsFromTranscript;

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
        return 'Something went wrong. Please try again.';
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
      onDonePress={() => navigation.goBack()}
      onRetryPress={() => setStatus('idle')}
    />
  );
}
