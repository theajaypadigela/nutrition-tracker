import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';
import { API_BASE_URL } from '../config/env';
import { HttpClient } from '../services/api/types';
import { getToken, clearToken } from '../services/storage/tokenStorage';

const REQUEST_TIMEOUT_MS = 10000;

/**
 * The single axios instance every request flows through.
 *
 * Typed as {@link HttpClient} at the export so consumers depend on the four-method
 * surface rather than all of axios — the same contract the `create*Api` factories
 * already accept, which is what makes them mockable without `jest.mock`.
 */
const instance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
});

type UnauthorizedHandler = () => void;

// Handler invoked when the server rejects auth (401). The AuthProvider registers its
// logout() here at startup, so the client owns the handler instead of sharing it through
// a global mutable in a separate module.
let unauthorizedHandler: UnauthorizedHandler | null = null;

export const registerUnauthorizedHandler = (
  handler: UnauthorizedHandler | null,
): void => {
  unauthorizedHandler = handler;
};

instance.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
);

instance.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await clearToken();
      unauthorizedHandler?.();
    }

    return Promise.reject(error);
  },
);

/** The configured client, narrowed to the surface consumers are allowed to use. */
const apiClient: HttpClient = instance;

export default apiClient;
