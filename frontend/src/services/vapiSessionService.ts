import Vapi from '@vapi-ai/react-native';
import apiClient from '../api/client';

export type VoiceSessionPurpose = 'meal' | 'habit';

export interface VapiSessionConfig {
  token: string;
  assistantId: string;
  purpose: VoiceSessionPurpose;
}

function normalizePurpose(value: unknown): VoiceSessionPurpose {
  return value === 'habit' ? 'habit' : 'meal';
}

function validateSessionConfig(
  data: any,
  fallbackPurpose: VoiceSessionPurpose,
): VapiSessionConfig {
  const token = typeof data?.token === 'string' ? data.token.trim() : '';
  const assistantId =
    typeof data?.assistantId === 'string' ? data.assistantId.trim() : '';

  if (!token || !assistantId) {
    throw new Error('Invalid voice session configuration returned by backend');
  }

  return {
    token,
    assistantId,
    purpose: normalizePurpose(data?.purpose ?? fallbackPurpose),
  };
}

export async function fetchVapiSessionConfig(
  purpose: VoiceSessionPurpose,
): Promise<VapiSessionConfig> {
  const response = await apiClient.get('/food/voice/session', {
    params: { purpose },
  });

  return validateSessionConfig(response?.data, purpose);
}

export async function initializeVapiClient(
  purpose: VoiceSessionPurpose,
): Promise<{ vapi: Vapi; assistantId: string }> {
  const sessionConfig = await fetchVapiSessionConfig(purpose);

  return {
    vapi: new Vapi(sessionConfig.token),
    assistantId: sessionConfig.assistantId,
  };
}
