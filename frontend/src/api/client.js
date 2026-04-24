import axios from 'axios';
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logoutHandler } from '../services/authService';

export const CUSTOM_BASE_URL_KEY = 'custom_base_url';
const DEV_API_PORT = 5000;
const LOCALHOST_HTTP_BASE_URL = `http://localhost:${DEV_API_PORT}/`;
const ANDROID_EMULATOR_HTTP_BASE_URL = `http://10.0.2.2:${DEV_API_PORT}/`;

const ALLOWED_HTTP_HOSTS = new Set(['localhost', '127.0.0.1', '10.0.2.2']);

function withTrailingSlash(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

function isPrivateIPv4(hostname) {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => Number.isNaN(part))) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

function getMetroHost() {
  if (!__DEV__) {
    return null;
  }

  const serverHost = NativeModules?.PlatformConstants?.ServerHost;
  if (typeof serverHost === 'string' && serverHost.trim()) {
    const trimmedServerHost = serverHost.trim();
    if (trimmedServerHost.startsWith('http://') || trimmedServerHost.startsWith('https://')) {
      try {
        const parsedServerHost = new URL(trimmedServerHost);
        if (parsedServerHost.hostname) {
          return parsedServerHost.hostname;
        }
      } catch {
        // Ignore malformed server host and continue to fallback detection.
      }
    } else {
      const [host] = trimmedServerHost.split(':');
      if (host) {
        return host;
      }
    }
  }

  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  if (typeof scriptURL !== 'string' || !scriptURL) {
    return null;
  }

  try {
    const parsed = new URL(scriptURL);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    return parsed.hostname || null;
  } catch {
    return null;
  }
}

function buildAndroidDevBaseUrls() {
  const urls = [];

  const addUrl = value => {
    const normalised = withTrailingSlash(value);
    if (!urls.includes(normalised)) {
      urls.push(normalised);
    }
  };

  const metroHost = getMetroHost();
  if (metroHost && !ALLOWED_HTTP_HOSTS.has(metroHost.toLowerCase())) {
    addUrl(`http://${metroHost}:${DEV_API_PORT}/`);
  }

  addUrl(LOCALHOST_HTTP_BASE_URL);
  addUrl(ANDROID_EMULATOR_HTTP_BASE_URL);

  return urls;
}

const ANDROID_DEV_BASE_URLS =
  Platform.OS === 'android' && __DEV__ ? buildAndroidDevBaseUrls() : [];

if (Platform.OS === 'android' && __DEV__) {
  console.log('Android dev API base URL candidates:', ANDROID_DEV_BASE_URLS);
}

function resolveDefaultBaseUrl() {
  if (ANDROID_DEV_BASE_URLS.length > 0) {
    return ANDROID_DEV_BASE_URLS[0];
  }

  return LOCALHOST_HTTP_BASE_URL;
}

export const DEFAULT_BASE_URL = resolveDefaultBaseUrl();

function isSecureOrLocalhostUrl(url) {
  try {
    const parsed = new URL(withTrailingSlash(url));
    if (parsed.protocol === 'https:') {
      return true;
    }
    if (parsed.protocol !== 'http:') {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    if (ALLOWED_HTTP_HOSTS.has(host)) {
      return true;
    }

    // Allow local network HTTP targets in development only.
    if (__DEV__ && (isPrivateIPv4(host) || host.endsWith('.local'))) {
      return true;
    }

    return false;
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

function getNextAndroidDevBaseUrl(currentBaseURL, attemptedBaseURLs = []) {
  if (ANDROID_DEV_BASE_URLS.length === 0) {
    return null;
  }

  const attempted = new Set(
    attemptedBaseURLs
      .filter(Boolean)
      .map(value => withTrailingSlash(String(value).trim())),
  );

  if (typeof currentBaseURL === 'string' && currentBaseURL.trim()) {
    attempted.add(withTrailingSlash(currentBaseURL.trim()));
  }

  return ANDROID_DEV_BASE_URLS.find(candidate => !attempted.has(candidate)) ?? null;
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
      if (isSecureOrLocalhostUrl(trimmed)) {
        config.baseURL = withTrailingSlash(trimmed);
      } else {
        // Prevent stale/invalid custom URL values from breaking all requests.
        await AsyncStorage.removeItem(CUSTOM_BASE_URL_KEY);
        console.warn(
          'Blocked custom API base URL and reverted to default base URL.',
        );
      }
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
    const originalConfig = error?.config;

    if (originalConfig && !error.response && !originalConfig.__retriedWithDefaultBaseUrl) {
      const customBaseURL = await AsyncStorage.getItem(CUSTOM_BASE_URL_KEY);
      const configuredBaseURL =
        typeof originalConfig.baseURL === 'string'
          ? withTrailingSlash(originalConfig.baseURL.trim())
          : '';
      const normalisedCustomBaseURL = customBaseURL
        ? withTrailingSlash(customBaseURL.trim())
        : '';

      if (configuredBaseURL && configuredBaseURL === normalisedCustomBaseURL) {
        await AsyncStorage.removeItem(CUSTOM_BASE_URL_KEY);
        originalConfig.__retriedWithDefaultBaseUrl = true;
        originalConfig.baseURL = DEFAULT_BASE_URL;
        console.warn(
          'Custom API base URL failed. Retrying with default base URL.',
        );
        return apiClient(originalConfig);
      }
    }

    if (originalConfig && !error.response) {
      const nextAndroidDevBaseURL = getNextAndroidDevBaseUrl(
        originalConfig.baseURL ?? DEFAULT_BASE_URL,
        originalConfig.__attemptedAndroidDevBaseURLs,
      );

      if (nextAndroidDevBaseURL) {
        originalConfig.__attemptedAndroidDevBaseURLs = [
          ...(originalConfig.__attemptedAndroidDevBaseURLs ?? []),
          withTrailingSlash(String(originalConfig.baseURL ?? DEFAULT_BASE_URL).trim()),
        ];
        originalConfig.baseURL = nextAndroidDevBaseURL;
        console.warn(
          `API request failed. Retrying with Android dev base URL: ${nextAndroidDevBaseURL}`,
        );
        return apiClient(originalConfig);
      }
    }

    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
      logoutHandler?.();
    }

    return Promise.reject(error);
  },
);

export default apiClient;
