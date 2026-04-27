import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logoutHandler } from '../services/authService';

const DEFAULT_BASE_URL =
  'http://ec2-3-109-239-9.ap-south-1.compute.amazonaws.com:5000/';

const apiClient = axios.create({
  baseURL: DEFAULT_BASE_URL,
  timeout: 10000,
});

apiClient.interceptors.request.use(async config => {
  // Keep all API calls pinned to the configured backend.
  config.baseURL = DEFAULT_BASE_URL;

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
      logoutHandler?.();
    }

    return Promise.reject(error);
  },
);

export { DEFAULT_BASE_URL };
export default apiClient;
