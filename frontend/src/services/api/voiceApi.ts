import apiClient from '@/api/client';
import { HttpClient } from './types';

export type VoiceSessionPurpose = 'meal' | 'habit';

/** Client-side config for one Vapi call, as returned by the backend. */
export interface VoiceSessionConfigResponse {
  token: string;
  assistantId: string;
  purpose: string;
}

/**
 * Voice-session endpoints. The session config is fetched per call and deliberately
 * not cached: the backend sends it `no-store`, because the token it carries is
 * scoped to the current user.
 */
export const createVoiceApi = (client: HttpClient = apiClient) => ({
  /** Config for initialising a Vapi call (GET /food/voice/session). */
  getSessionConfig: (purpose: VoiceSessionPurpose) =>
    client
      .get<VoiceSessionConfigResponse>('/food/voice/session', {
        params: { purpose },
      })
      .then(r => r.data),
});

export const voiceApi = createVoiceApi();
