import apiClient from '@/api/client';
import type { HttpClient } from './types';

/** Authenticated device-token endpoints used by iOS PushKit delivery. */
export const createNotificationApi = (client: HttpClient = apiClient) => ({
  registerIosVoipToken: (token: string) =>
    client
      .post('/notifications/ios/voip-token', { token })
      .then(response => response.data),

  unregisterIosVoipToken: (token: string) =>
    client
      .delete('/notifications/ios/voip-token', { data: { token } })
      .then(response => response.data),
});

export const notificationApi = createNotificationApi();
