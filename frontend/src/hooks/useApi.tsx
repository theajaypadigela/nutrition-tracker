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

  const pendingRequestCountRef = useRef(0);
  const cancelTokenSourcesRef = useRef<Set<CancelTokenSource>>(new Set());
  const isMountedRef = useRef(true);

  const request = useCallback(
    async ({
      url,
      method = 'GET',
      data: requestData = null,
      params = {},
      headers = {},
    }: UseApiOptions): Promise<T> => {
      pendingRequestCountRef.current += 1;
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }

      const cancelTokenSource = axios.CancelToken.source();
      cancelTokenSourcesRef.current.add(cancelTokenSource);

      try {
        const config: AxiosRequestConfig = {
          url,
          method,
          data: requestData,
          params,
          headers,
          cancelToken: cancelTokenSource.token,
        };

        const response = await apiClient.request<T>(config);
        if (isMountedRef.current) {
          setData(response.data);
        }
        return response.data;
      } catch (err) {
        if (axios.isCancel(err)) {
          throw err;
        }

        const axiosError = err as AxiosError<{ message?: string }>;
        const errorMessage =
          axiosError.response?.data?.message ||
          axiosError.message ||
          'An unexpected error occurred';

        if (isMountedRef.current) {
          setError(errorMessage);
        }
        throw err;
      } finally {
        cancelTokenSourcesRef.current.delete(cancelTokenSource);
        pendingRequestCountRef.current = Math.max(
          0,
          pendingRequestCountRef.current - 1,
        );

        if (isMountedRef.current) {
          setLoading(pendingRequestCountRef.current > 0);
        }
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cancelTokenSourcesRef.current.forEach(source =>
        source.cancel('Component unmounted'),
      );
      cancelTokenSourcesRef.current.clear();
    };
  }, []);

  return { data, loading, error, request };
}
