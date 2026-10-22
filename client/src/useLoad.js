import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

// Loads GET /api<path>; returns { data, error, reload }.
export function useLoad(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const reload = useCallback(() => {
    api(path).then(setData).catch((e) => setError(e.message));
  }, [path]);
  useEffect(reload, [reload]);
  return { data, error, reload };
}
