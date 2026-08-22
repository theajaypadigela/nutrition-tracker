import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import Vapi from '@vapi-ai/react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { HabitVoiceResult } from '../../types/types';
import { scheduleHabitReschedule } from '../../services/habitScheduler';
import VoiceSessionScreen, {
  CallStatus,
} from '../../components/voice/VoiceSessionScreen';
import { habitApi } from '../../features/habits/api/habitApi';
import { getVapiConfiguration } from '../../config/buildConfig';
import {
  finishVoiceSession,
  waitForVoiceCallEnd,
} from '../../services/voiceSessionLifecycle';
import { reconcileReminders } from '../../services/reminderCoordinator';

type VoiceHabitRoute = RouteProp<
  {
    VoiceHabit:
      | {
          habitId?: string;
          habitName?: string;
          habitTime?: string;
          autoStart?: boolean;
        }
      | undefined;
  },
  'VoiceHabit'
>;

interface VoiceHabitMessage {
  type?: string;
  role?: string;
  transcriptType?: string;
  transcript?: string;
  functionCall?: {
    parameters?: HabitVoiceResult;
  };
  analysis?: {
    structuredData?: HabitVoiceResult;
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

function normalizeHabitStatus(
  status?: string,
): 'completed' | 'rescheduled' | 'not_completed' {
  const normalized = status?.toLowerCase().trim();
  if (normalized === 'completed') return 'completed';
  if (normalized === 'rescheduled') return 'rescheduled';
  return 'not_completed';
}

export default function VoiceHabitScreen() {
  const navigation = useNavigation();
  const route = useRoute<VoiceHabitRoute>();
  const { user } = useAuth();

  const habitId: string | undefined = route.params?.habitId;
  const habitName: string = route.params?.habitName ?? 'Habit';
  const habitTime: string = route.params?.habitTime ?? '';
  const autoStart: boolean = route.params?.autoStart === true;

  const [status, setStatus] = useState<CallStatus>('idle');
  const [transcript, setTranscript] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const vapiRef = useRef<Vapi | null>(null);
  const transcriptRef = useRef<string[]>([]);
  const voiceResultRef = useRef<HabitVoiceResult | null>(null);
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
      vapiConfiguration = getVapiConfiguration('habit');
    } catch (error) {
      console.error('[VapiHabit] Build configuration error:', error);
      setStatus('error');
      return () => {
        isMountedRef.current = false;
      };
    }

    const vapi = new Vapi(vapiConfiguration.publicKey);
    vapiRef.current = vapi;
    vapiAssistantIdRef.current = vapiConfiguration.assistantId;

    vapi.on('call-start', () => {
      console.log('[VapiHabit] Call started');
      setStatus('active');
      try {
        vapi.setMuted(false);
      } catch (e) {
        console.warn('[VapiHabit] Could not unmute:', e);
      }
    });

    vapi.on('call-end', () => {
      console.log('[VapiHabit] Call ended');
      resolveCallEndRef.current?.();
      resolveCallEndRef.current = null;
      finalizeCapturedResult().catch(error => {
        console.error('[VapiHabit] Failed to persist call result:', error);
      });
    });

    vapi.on('speech-start', () => {
      setIsSpeaking(true);
    });

    vapi.on('speech-end', () => {
      setIsSpeaking(false);
    });

    vapi.on('error', e => {
      console.error('[VapiHabit] Error:', e);
      setStatus('error');
    });

    vapi.on('message', (msg: VoiceHabitMessage) => {
      console.log(
        '[VapiHabit] Message:',
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

      // Capture structured data from function calls or end-of-call report
      if (msg.type === 'function-call' && msg.functionCall?.parameters) {
        const params = msg.functionCall.parameters;
        if (params.habit_status) {
          voiceResultRef.current = params;
          console.log(
            '[VapiHabit] Captured result from function call:',
            params,
          );
        }
      }

      // Also check for structured data in analysis/result messages
      if (msg.type === 'end-of-call-report' && msg.analysis?.structuredData) {
        voiceResultRef.current = msg.analysis.structuredData;
        console.log(
          '[VapiHabit] Captured result from analysis:',
          msg.analysis.structuredData,
        );
      }
    });

    return () => {
      isMountedRef.current = false;
      vapiRef.current = null;
      vapiAssistantIdRef.current = null;
      finishVoiceSession(vapi, finalizeCapturedResult, () =>
        waitForVoiceCallEnd(callEndPromiseRef.current),
      ).catch(error => {
        console.warn('[VapiHabit] Voice session teardown failed:', error);
      });
    };
  }, [finalizeCapturedResult]);

  // Auto-start
  useEffect(() => {
    if (autoStart && status === 'idle') {
      startVoiceCall();
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

  const startVoiceCall = useCallback(async () => {
    setStatus('requesting');
    setTranscript([]);
    transcriptRef.current = [];
    voiceResultRef.current = null;
    setResultMessage('');
    finalizationPromiseRef.current = null;
    callEndPromiseRef.current = new Promise(resolve => {
      resolveCallEndRef.current = resolve;
    });

    const hasPermission = await requestMicPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'Microphone access is needed for the habit assistant.',
      );
      setStatus('idle');
      return;
    }

    const vapi = vapiRef.current;
    if (!vapi) {
      console.error('[VapiHabit] No Vapi instance available');
      setStatus('error');
      return;
    }

    const assistantId = vapiAssistantIdRef.current;
    if (!assistantId) {
      console.error('[VapiHabit] Habit assistant configuration is unavailable');
      setStatus('error');
      return;
    }

    try {
      console.log('[VapiHabit] Starting configured habit assistant call');
      await vapi.start(assistantId, {
        metadata: { userId: user?.id ?? '' },
        variableValues: {
          name: user?.name ?? 'User',
          habit: habitName,
          habit_time: habitTime,
        },
      });
      console.log('[VapiHabit] Call start initiated');
    } catch (err) {
      console.error('[VapiHabit] Failed to start voice session:', err);
      Alert.alert('Error', 'Could not start voice session. Please try again.');
      setStatus('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestMicPermission, user?.id, habitName, habitTime]);

  const stopVoiceCall = useCallback(() => {
    const vapi = vapiRef.current;
    if (!vapi) return;
    try {
      vapi.stop();
    } catch (err) {
      console.error('[VapiHabit] Failed to stop voice session:', err);
    }
  }, []);

  const processHabitResult = useCallback(async () => {
    if (isMountedRef.current) setStatus('processing');

    if (!habitId) {
      console.log('[VapiHabit] Missing habitId, skipping result processing.');
      if (isMountedRef.current) {
        setResultMessage('Call completed');
        setStatus('completed');
      }
      return;
    }

    const inferredDelay = extractDelayMinutes(transcriptRef.current);
    let result = voiceResultRef.current;

    if (!result && inferredDelay != null) {
      result = {
        habit_name: habitName,
        habit_status: 'rescheduled',
        reschedule_minutes: inferredDelay,
      };
      console.log('[VapiHabit] Inferred reschedule from transcript:', {
        inferredDelay,
      });
    }

    if (!result) {
      console.log('[VapiHabit] No structured result captured from call.');
      if (isMountedRef.current) {
        setResultMessage('Call completed');
        setStatus('completed');
      }
      return;
    }

    const habitStatus = normalizeHabitStatus(result.habit_status);
    const delayMinutes = result.reschedule_minutes ?? inferredDelay ?? null;

    try {
      console.log('[VapiHabit] Processing result:', {
        ...result,
        habit_status: habitStatus,
        resolved_delay_minutes: delayMinutes,
      });

      const response = await habitApi.recordVoiceResult({
        habitId: parseInt(habitId, 10),
        habitName: result.habit_name || habitName,
        habitStatus,
        rescheduleMinutes: delayMinutes,
        completedAt: result.completed_at,
      });
      console.log('[VapiHabit] Backend voice-result response:', response);

      if (user?.id) {
        try {
          await reconcileReminders(user.id);
        } catch (reminderError) {
          console.warn(
            '[VapiHabit] Reminder reconciliation will retry on foreground:',
            reminderError,
          );
        }
      }

      if (habitStatus === 'completed') {
        if (isMountedRef.current) {
          setResultMessage(`✅ "${habitName}" marked as completed!`);
        }
      } else if (habitStatus === 'rescheduled') {
        const mins = delayMinutes ?? 0;
        if (isMountedRef.current) {
          setResultMessage(
            `⏰ "${habitName}" rescheduled. Will check again in ${mins} minutes.`,
          );
        }

        // Schedule local notification for the rescheduled time
        if (mins > 0) {
          const scheduled = user?.id
            ? await scheduleHabitReschedule(
                {
                  id: habitId,
                  name: habitName,
                  reminderTime: habitTime,
                  reminderType: 'call',
                  completed: false,
                  repeatDays: [],
                },
                mins,
                user.id,
              )
            : false;

          if (!scheduled) {
            if (isMountedRef.current) {
              setResultMessage(
                'Could not schedule follow-up because it would fall on the next day.',
              );
            }
            console.log(
              '[VapiHabit] Skipped habit follow-up scheduling due to current-day rule.',
              { mins },
            );
          }
        }
      } else {
        if (isMountedRef.current) {
          setResultMessage(`"${habitName}" marked as missed.`);
        }
      }

      if (isMountedRef.current) setStatus('completed');
    } catch (err) {
      console.error('[VapiHabit] Failed to process result:', err);
      if (isMountedRef.current) setStatus('error');
    }
  }, [habitId, habitName, habitTime, user?.id]);

  persistCapturedResultRef.current = processHabitResult;

  const getStatusText = () => {
    switch (status) {
      case 'idle':
        return 'Tap the microphone to start your habit check-in';
      case 'requesting':
        return 'Starting session...';
      case 'active':
        return isSpeaking ? 'Assistant is speaking...' : 'Listening...';
      case 'processing':
        return 'Processing your response...';
      case 'completed':
        return resultMessage || 'Call completed';
      case 'error':
        return 'Something went wrong. Please try again.';
      default:
        return '';
    }
  };

  return (
    <VoiceSessionScreen
      title={habitName}
      statusText={getStatusText()}
      status={status}
      isSpeaking={isSpeaking}
      transcript={transcript}
      onPrimaryPress={status === 'active' ? stopVoiceCall : startVoiceCall}
      disablePrimary={status === 'requesting' || status === 'processing'}
      processingText="Processing your habit check-in..."
      doneButtonText="Back to Habits"
      onDonePress={() => navigation.goBack()}
      onRetryPress={() => setStatus('idle')}
    />
  );
}
