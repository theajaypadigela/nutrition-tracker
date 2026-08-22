import apiClient from '../../../shared/api/client';

export interface VoiceTokenResponse {
  token: string;
}

export interface ParseMealTranscriptRequest {
  transcript: string;
}

export interface ParseMealTranscriptResponse {
  status?: string;
  entriesLogged?: number;
  error?: string;
}

export const voiceApi = {
  async getCallToken(): Promise<VoiceTokenResponse> {
    const { data } =
      await apiClient.get<VoiceTokenResponse>('/food/voice/token');
    return data;
  },

  async parseMealTranscript(
    request: ParseMealTranscriptRequest,
  ): Promise<ParseMealTranscriptResponse> {
    const { data } = await apiClient.post<ParseMealTranscriptResponse>(
      '/food/voice-log/parse-transcript',
      request,
    );
    return data;
  },
};
