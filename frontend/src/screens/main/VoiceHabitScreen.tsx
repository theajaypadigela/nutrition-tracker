import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import Vapi from '@vapi-ai/react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { HabitVoiceResult } from '../../types/types';
import { scheduleHabitReschedule } from '../../services/habitScheduler';
import VoiceSessionScreen, {
  CallStatus,
} from '../../components/voice/VoiceSessionScreen';

const VAPI_PUBLIC_KEY = 'ee6c4930-dd4c-416e-9c58-090b8b46eee5';
const VAPI_HABIT_ASSISTANT_ID = '21a94bba-766c-46bb-8df8-9c7e9aeed50a';

export default function VoiceHabitScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
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

  // Wire up Vapi events
  useEffect(() => {
    const vapi = new Vapi(VAPI_PUBLIC_KEY);
    vapiRef.current = vapi;

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
      processHabitResult();
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

    vapi.on('message', (msg: any) => {
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
          voiceResultRef.current = params as HabitVoiceResult;
          console.log(
            '[VapiHabit] Captured result from function call:',
            params,
          );
        }
      }

      // Also check for structured data in analysis/result messages
      if (msg.type === 'end-of-call-report' && msg.analysis?.structuredData) {
        voiceResultRef.current = msg.analysis
          .structuredData as HabitVoiceResult;
        console.log(
          '[VapiHabit] Captured result from analysis:',
          msg.analysis.structuredData,
        );
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

    try {
      console.log(
        '[VapiHabit] Starting call with assistant:',
        VAPI_HABIT_ASSISTANT_ID,
      );
      await vapi.start(VAPI_HABIT_ASSISTANT_ID, {
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
    setStatus('processing');

    const result = voiceResultRef.current;
    if (!result || !habitId) {
      setResultMessage('Call completed');
      setStatus('completed');
      return;
    }

    try {
      console.log('[VapiHabit] Processing result:', result);

      await apiClient.post('/habit/voice-result', {
        habitId: parseInt(habitId, 10),
        habitName: result.habit_name || habitName,
        habitStatus: result.habit_status,
        rescheduleMinutes: result.reschedule_minutes,
        completedAt: result.completed_at,
      });

      if (result.habit_status === 'completed') {
        setResultMessage(`✅ "${habitName}" marked as completed!`);
      } else if (result.habit_status === 'rescheduled') {
        const mins = result.reschedule_minutes ?? 0;
        setResultMessage(
          `⏰ "${habitName}" rescheduled. Will check again in ${mins} minutes.`,
        );

        // Schedule local notification for the rescheduled time
        if (mins > 0) {
          await scheduleHabitReschedule(
            {
              id: habitId,
              name: habitName,
              reminderTime: habitTime,
              reminderType: 'call',
              completed: false,
              repeatDays: [],
            },
            mins,
          );
        }
      } else {
        setResultMessage(`"${habitName}" marked as missed.`);
      }

      setStatus('completed');
    } catch (err) {
      console.error('[VapiHabit] Failed to process result:', err);
      setStatus('error');
    }
  }, [habitId, habitName, habitTime]);

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
