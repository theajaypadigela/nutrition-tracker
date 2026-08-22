import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getErrorMessage } from '../../shared/errors/getErrorMessage';

type ApiOperation<TResult> = (signal: AbortSignal) => Promise<TResult>;

export function useApiOperation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(
    async <TResult>(operation: ApiOperation<TResult>): Promise<TResult> => {
      setLoading(true);
      setError(null);

      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        return await operation(abortController.signal);
      } catch (operationError: unknown) {
        if (!axios.isCancel(operationError)) {
          setError(getErrorMessage(operationError));
        }
        throw operationError;
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  return { loading, error, execute };
}
