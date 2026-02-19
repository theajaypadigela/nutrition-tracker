import { useState, useCallback, useRef, useEffect } from 'react';
import axios, {
  AxiosRequestConfig,
  AxiosError,
  CancelTokenSource,
} from 'axios';
import apiClient from '../api/client';

interface UseApiOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
}

interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  request: (options: UseApiOptions) => Promise<T>;
}

export default function useApi<T = any>(): UseApiReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelTokenSourceRef = useRef<CancelTokenSource | null>(null);

  const request = useCallback(
    async ({
      url,
      method = 'GET',
      data: requestData = null,
      params = {},
      headers = {},
    }: UseApiOptions): Promise<T> => {
      setLoading(true);
      setError(null);

      if (cancelTokenSourceRef.current) {
        cancelTokenSourceRef.current.cancel('New request initiated');
      }

      // Create new cancel token
      cancelTokenSourceRef.current = axios.CancelToken.source();

      try {
        const config: AxiosRequestConfig = {
          url,
          method,
          data: requestData,
          params,
          headers,
          cancelToken: cancelTokenSourceRef.current.token,
        };

        const response = await apiClient.request<T>(config);
        setData(response.data);
        return response.data;
      } catch (err) {
        if (axios.isCancel(err)) {
          // Request was cancelled, don't set error
          throw err;
        }

        const axiosError = err as AxiosError<{ message?: string }>;
        const errorMessage =
          axiosError.response?.data?.message ||
          axiosError.message ||
          'An unexpected error occurred';

        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      // Cancel any pending requests on unmount
      if (cancelTokenSourceRef.current) {
        cancelTokenSourceRef.current.cancel('Component unmounted');
      }
    };
  }, []);

  return { data, loading, error, request };
}
