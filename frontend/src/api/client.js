import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logoutHandler } from '../services/authService';

export const CUSTOM_BASE_URL_KEY = 'custom_base_url';

const ALLOWED_HTTP_HOSTS = new Set(['localhost', '127.0.0.1', '10.0.2.2']);

// export const DEFAULT_BASE_URL =
//   Platform.OS === 'android'
//     ? 'http://3.109.239.9:5000/'
//     : 'http://3.109.239.9:5000/';

export const DEFAULT_BASE_URL =
  Platform.OS === 'android'
    ? 'http://localhost:5000/'
    : 'http://localhost:5000/';

function withTrailingSlash(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

function isSecureOrLocalhostUrl(url) {
  try {
    const parsed = new URL(withTrailingSlash(url));
    if (parsed.protocol === 'https:') {
      return true;
    }
    if (parsed.protocol !== 'http:') {
      return false;
    }

    return ALLOWED_HTTP_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function throwIfInsecureBaseUrl(url) {
  if (!url || isSecureOrLocalhostUrl(url)) {
    return;
  }

  throw new Error(
    'Insecure API base URL blocked. Use HTTPS for non-local backend URLs.',
  );
}

const apiClient = axios.create({
  baseURL: DEFAULT_BASE_URL,
  timeout: 10000,
});

// Add request interceptor to include token in headers and dynamic base URL
apiClient.interceptors.request.use(async config => {
  // Dynamically read custom base URL so it reflects runtime changes
  const customBaseURL = await AsyncStorage.getItem(CUSTOM_BASE_URL_KEY);
  if (customBaseURL) {
    const trimmed = customBaseURL.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      throwIfInsecureBaseUrl(trimmed);
      config.baseURL = withTrailingSlash(trimmed);
    }
  }

  throwIfInsecureBaseUrl(config.baseURL);

  const requestUrl = typeof config.url === 'string' ? config.url.trim() : '';
  if (requestUrl.startsWith('http://') || requestUrl.startsWith('https://')) {
    throwIfInsecureBaseUrl(requestUrl);
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
