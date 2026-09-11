"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/supabase";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: (value: T | null) => void;
}

/**
 * Runs an async loader and exposes the loading / empty / error states every
 * page in this app is required to render. `deps` behaves like useEffect deps.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // Keeps a stale response from a superseded request out of state.
  const requestId = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const current = ++requestId.current;
    let active = true;

    setLoading(true);
    setError(null);

    loaderRef
      .current()
      .then((result) => {
        if (!active || current !== requestId.current) return;
        setData(result);
      })
      .catch((caught) => {
        if (!active || current !== requestId.current) return;
        setError(errorMessage(caught));
      })
      .finally(() => {
        if (!active || current !== requestId.current) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { data, loading, error, reload, setData };
}

/** Debounces any value — used for search inputs feeding Supabase queries. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
