/** React hooks for loading data and running mutations with consistent loading/error state. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, toApiError } from './api';

/** The part of a `useAsync` result that `<Async>` and list components need. */
export interface AsyncState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Loads data when `deps` change and exposes `{ data, error, loading, reload, setData }`.
 * Out-of-order responses are ignored, so only the latest request updates state.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const run = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const d = await fn();
      if (id === seq.current) setData(d);
    } catch (e) {
      if (id === seq.current) setError(e instanceof ApiError ? e : toApiError(e as Error));
    } finally {
      if (id === seq.current) setLoading(false);
    }
    // Callers pass the dependencies explicitly, like useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    run();
  }, [run]);
  return { data, error, loading, reload: run, setData };
}

/**
 * Wraps a mutation: ignores a second call while one is running (prevents double submit)
 * and exposes `busy` / `error`. `run` resolves to `undefined` when the call failed or was ignored.
 */
export function useMutation<A extends unknown[], R>(fn: (...a: A) => Promise<R>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const busyRef = useRef(false);
  const run = useCallback(
    async (...a: A): Promise<R | undefined> => {
      if (busyRef.current) return undefined;
      busyRef.current = true;
      setBusy(true);
      setError(null);
      try {
        return await fn(...a);
      } catch (e) {
        setError(e instanceof ApiError ? e : toApiError(e as Error));
        return undefined;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [fn],
  );
  return { run, busy, error, setError };
}
