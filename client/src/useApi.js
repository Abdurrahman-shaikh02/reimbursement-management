import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

// Loads `path` on mount (and when it changes). `reload` fetches it again.
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    api(path)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => setState({ data: null, error, loading: false }));
  }, [path]);

  useEffect(load, [load]);

  return { ...state, reload: load };
}
