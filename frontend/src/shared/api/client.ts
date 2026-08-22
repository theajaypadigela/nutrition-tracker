import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

import { buildConfig } from '../../config/buildConfig';
import {
  AUTHENTICATED_USER_ID_STORAGE_KEY,
  CUSTOM_BASE_URL_KEY,
  TOKEN_STORAGE_KEY,
} from '../storage/keys';
import { publishUnauthorized } from './sessionEvents';

export { CUSTOM_BASE_URL_KEY } from '../storage/keys';

export const DEFAULT_BASE_URL = buildConfig.apiBaseUrl;

const apiClient = axios.create({
  baseURL: DEFAULT_BASE_URL,
  timeout: 10_000,
});

apiClient.interceptors.request.use(async config => {
  const [customBaseURL, token] = await Promise.all([
    __DEV__ ? AsyncStorage.getItem(CUSTOM_BASE_URL_KEY) : null,
    AsyncStorage.getItem(TOKEN_STORAGE_KEY),
  ]);

  if (customBaseURL) {
    config.baseURL = customBaseURL;
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  response => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      await Promise.all([
        AsyncStorage.removeItem(TOKEN_STORAGE_KEY),
        AsyncStorage.removeItem(AUTHENTICATED_USER_ID_STORAGE_KEY),
      ]);
      publishUnauthorized();
    }

    return Promise.reject(error);
  },
);

export default apiClient;
