import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import Vapi from '@vapi-ai/react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { scheduleMealReschedule } from '../../services/mealScheduler';
import VoiceSessionScreen, {
  CallStatus,
} from '../../components/voice/VoiceSessionScreen';

const VAPI_PUBLIC_KEY = 'ee6c4930-dd4c-416e-9c58-090b8b46eee5';
const VAPI_ASSISTANT_ID = 'b544afb0-dd75-4922-be50-e080e01db1b0';

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
  const route = useRoute<any>();
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

  // Wire up Vapi events
  useEffect(() => {
    // Create a fresh Vapi instance for this screen
    const vapi = new Vapi(VAPI_PUBLIC_KEY);
    vapiRef.current = vapi;

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
      vapi.removeAllListeners();
      try {
        vapi.stop();
      } catch {
        // Ignore cleanup errors
      }
      vapiRef.current = null;
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
    setEntriesLogged(0);
    setFollowUpMessage('');
    delayMinutesRef.current = null;

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

    try {
      console.log('[Vapi] Starting call with assistant:', VAPI_ASSISTANT_ID);
      await vapi.start(VAPI_ASSISTANT_ID, {
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
      const today = new Date().toISOString().split('T')[0];
      const maxAttempts = 12;
      const delayMs = 1500;

      // Track baseline counts so we only wait for entries from this voice session.
      let initialEnrichedCount = 0;
      let initialTotalCount = 0;
      try {
        const initialRes = await apiClient.get(`/food/${today}`);
        const meals = initialRes.data?.meals || {};
        const initialItems = Object.values(meals).flat() as any[];
        initialTotalCount = initialItems.length;
        initialEnrichedCount = Object.values(meals)
          .flat()
          .filter((item: any) => item.calories != null).length;
      } catch {
        // Ignore initial check errors
      }

      const targetTotalCount = initialTotalCount + expectedNewEntries;
      const targetEnrichedCount = initialEnrichedCount + expectedNewEntries;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          const res = await apiClient.get(`/food/${today}`);
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
    const lines = transcriptRef.current;
    if (lines.length === 0) {
      setStatus('completed');
      return;
    }

    setStatus('processing');
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
      const response = await apiClient.post(
        '/food/voice-log/parse-transcript',
        {
          transcript: fullTranscript,
        },
      );
      const count = response.data?.entriesLogged ?? 0;
      setEntriesLogged(count);
      console.log('[VoiceMealLog] Logged', count, 'meal entries');

      // Wait for nutrition enrichment to complete (poll for a few seconds)
      if (count > 0) {
        console.log('[VoiceMealLog] Waiting for nutrition enrichment...');
        await waitForNutritionEnrichment(count);
      }

      if (delayMinutes != null && delayMinutes > 0) {
        const scheduled = await scheduleMealReschedule(delayMinutes);
        if (scheduled) {
          const message = `Follow-up call scheduled in ${delayMinutes} minute${delayMinutes === 1 ? '' : 's'} (today only).`;
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
      }

      setStatus('completed');
    } catch (err) {
      console.error('[VoiceMealLog] Failed to parse transcript:', err);
      setStatus('error');
    }
  }, [waitForNutritionEnrichment]);

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
