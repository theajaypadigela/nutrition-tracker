import { useState, useCallback } from 'react';
import apiClient from '../api/client';

export const useApi = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (method, url, body = null) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient({
        method,
        url,
        data: body,
      });

      setData(response.data);
      return response.data;

    } catch (err) {
      setError(err.response?.data || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, request };
};
