import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logoutHandler } from '../services/authService';

export const CUSTOM_BASE_URL_KEY = 'custom_base_url';

export const DEFAULT_BASE_URL =
  Platform.OS === 'android'
    ? 'http://localhost:8080/'
    : 'http://localhost:8080/';

const apiClient = axios.create({
  baseURL: DEFAULT_BASE_URL,
  timeout: 10000,
});

// Add request interceptor to include token in headers and dynamic base URL
apiClient.interceptors.request.use(async config => {
  // Dynamically read custom base URL so it reflects runtime changes
  const customBaseURL = await AsyncStorage.getItem(CUSTOM_BASE_URL_KEY);
  if (customBaseURL) {
    config.baseURL = customBaseURL;
  }

  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Add response interceptor to handle 401 errors
apiClient.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
      logoutHandler?.();
    }

    return Promise.reject(error);
  },
);

export default apiClient;
