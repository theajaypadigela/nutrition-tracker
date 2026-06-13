import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/env';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Handler invoked when the server rejects auth (401). The AuthProvider registers its
// logout() here at startup. This replaces the old global-mutable `logoutHandler` that
// was shared through services/authService and coupled the client to that module.
let unauthorizedHandler = null;

export const registerUnauthorizedHandler = handler => {
  unauthorizedHandler = handler;
};

apiClient.interceptors.request.use(async config => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
      unauthorizedHandler?.();
    }

    return Promise.reject(error);
  },
);

// Re-exported under the original name for any code still importing DEFAULT_BASE_URL.
export { API_BASE_URL as DEFAULT_BASE_URL };
export default apiClient;
