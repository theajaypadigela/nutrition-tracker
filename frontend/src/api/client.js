import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logoutHandler } from '../services/authService';

const baseURL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:8080/'
    : 'http://localhost:8080/';

const apiClient = axios.create({
  baseURL,
  timeout: 10000,
});

// Add request interceptor to include token in headers
apiClient.interceptors.request.use(async config => {
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
  }
);

export default apiClient;
