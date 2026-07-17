import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import Vapi from '@vapi-ai/react-native';
import {
  initializeVapiClient,
  VoiceSessionPurpose,
} from '../services/vapiSessionService';
import { toDebugJson } from '../utils/debug';
import { useMicrophonePermission } from './useMicrophonePermission';
import type { CallStatus } from '../components/voice/VoiceSessionScreen';

/**
 * Loosely-typed Vapi client event message; the SDK does not export a message
 * union, so model only the fields the app inspects.
 */
export interface VapiMessage {
  type?: string;
  role?: string;
  transcriptType?: string;
  transcript?: string;
  message?: { type?: string };
  [key: string]: unknown;
}

export interface UseVapiSessionOptions {
  purpose: VoiceSessionPurpose;
  /** Prefix for console logs, e.g. 'Vapi' or 'VapiHabit'. */
  logTag: string;
  /** Alert body shown when microphone permission is denied. */
  permissionDeniedMessage: string;
  /** Assistant overrides for vapi.start(); evaluated when the call starts. */
  getVariableValues: () => Record<string, string>;
  /** Reset lane-specific state before a new call begins. */
  onSessionReset?: () => void;
  /** Called when the call ends; read the conversation via transcriptRef. */
  onCallEnd: () => void;
  onMessage?: (msg: VapiMessage) => void;
}

export interface UseVapiSessionResult {
  status: CallStatus;
  setStatus: React.Dispatch<React.SetStateAction<CallStatus>>;
  transcript: string[];
  isSpeaking: boolean;
  transcriptRef: React.MutableRefObject<string[]>;
  volumeLevelRef: React.MutableRefObject<number>;
  startSession: () => Promise<void>;
  stopSession: () => void;
}

/**
 * Owns the shared Vapi voice-call lifecycle (session creation, event wiring,
 * mic permission gating, cleanup). Lane-specific behavior is injected via
 * options; callbacks are read through a ref so listeners registered at call
 * start always see the latest render's closures.
 */
export function useVapiSession(
  options: UseVapiSessionOptions,
): UseVapiSessionResult {
  const { purpose, logTag } = options;
  const [status, setStatus] = useState<CallStatus>('idle');
  const [transcript, setTranscript] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const vapiRef = useRef<Vapi | null>(null);
  const transcriptRef = useRef<string[]>([]);
  const lastVapiMessageRef = useRef<VapiMessage | null>(null);
  const structuredVapiOutputRef = useRef<VapiMessage | null>(null);
  const volumeLevelRef = useRef(0);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const requestMicPermission = useMicrophonePermission();

  const disposeVapiInstance = useCallback(() => {
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
  }, []);

  const registerVapiListeners = useCallback(
    (vapi: Vapi) => {
      vapi.on('call-start', () => {
        console.log(`[${logTag}] Call started`);
        setStatus('active');
        // Ensure microphone is unmuted when call starts
        try {
          vapi.setMuted(false);
          console.log(`[${logTag}] Microphone unmuted`);
        } catch (e) {
          console.warn(`[${logTag}] Could not unmute:`, e);
        }
      });

      vapi.on('call-end', () => {
        console.log(`[${logTag}] Call ended`);

        if (structuredVapiOutputRef.current) {
          console.log(
            `[${logTag}] Structured output captured at call end:`,
            toDebugJson(structuredVapiOutputRef.current),
          );
        } else if (lastVapiMessageRef.current) {
          console.log(
            `[${logTag}] No explicit structured payload captured. Last Vapi message:`,
            toDebugJson(lastVapiMessageRef.current),
          );
        } else {
          console.log(
            `[${logTag}] No Vapi messages were captured before call end`,
          );
        }

        optionsRef.current.onCallEnd();
      });

      vapi.on('speech-start', () => {
        console.log(`[${logTag}] Speech started (assistant speaking)`);
        setIsSpeaking(true);
      });

      vapi.on('speech-end', () => {
        console.log(`[${logTag}] Speech ended`);
        setIsSpeaking(false);
      });

      vapi.on('error', e => {
        console.error(`[${logTag}] Error:`, e);
        setStatus('error');
      });

      vapi.on('message', (msg: VapiMessage) => {
        lastVapiMessageRef.current = msg;

        console.log(
          `[${logTag}] Message received:`,
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
          console.log(
            `[${logTag}] Structured payload candidate:`,
            toDebugJson(msg),
          );
        }

        if (msg.type === 'transcript' && msg.transcriptType === 'final') {
          const prefix = msg.role === 'assistant' ? 'Assistant: ' : 'You: ';
          const line = `${prefix}${msg.transcript}`;
          setTranscript(prev => [...prev, line]);
          transcriptRef.current = [...transcriptRef.current, line];
        }

        optionsRef.current.onMessage?.(msg);
      });

      vapi.on('volume-level', (volume: number) => {
        volumeLevelRef.current = volume;
        // Log volume level periodically to debug mic input
        if (volume > 0.01) {
          console.log(`[${logTag}] Volume level:`, volume.toFixed(3));
        }
      });
    },
    [logTag],
  );

  // Cleanup Vapi instance when leaving the screen.
  useEffect(() => {
    return () => {
      disposeVapiInstance();
    };
  }, [disposeVapiInstance]);

  const startSession = useCallback(async () => {
    setStatus('requesting');
    setTranscript([]);
    transcriptRef.current = [];
    lastVapiMessageRef.current = null;
    structuredVapiOutputRef.current = null;
    optionsRef.current.onSessionReset?.();

    const hasPermission = await requestMicPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        optionsRef.current.permissionDeniedMessage,
      );
      setStatus('idle');
      return;
    }

    try {
      disposeVapiInstance();
      const { vapi, assistantId } = await initializeVapiClient(purpose);
      registerVapiListeners(vapi);
      vapiRef.current = vapi;

      console.log(`[${logTag}] Starting call with backend-issued session config`);
      await vapi.start(assistantId, {
        variableValues: optionsRef.current.getVariableValues(),
      });
      console.log(`[${logTag}] Call start initiated`);
    } catch (err) {
      console.error(`[${logTag}] Failed to start voice session:`, err);
      Alert.alert('Error', 'Could not start voice session. Please try again.');
      setStatus('error');
    }
  }, [
    purpose,
    logTag,
    requestMicPermission,
    disposeVapiInstance,
    registerVapiListeners,
  ]);

  const stopSession = useCallback(() => {
    const vapi = vapiRef.current;
    if (!vapi) return;

    try {
      console.log(`[${logTag}] Stopping call`);
      vapi.stop();
    } catch (err) {
      console.error(`[${logTag}] Failed to stop voice session:`, err);
    }
  }, [logTag]);

  return {
    status,
    setStatus,
    transcript,
    isSpeaking,
    transcriptRef,
    volumeLevelRef,
    startSession,
    stopSession,
  };
}
