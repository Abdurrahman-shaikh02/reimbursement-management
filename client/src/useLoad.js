import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

// Ignore superseded requests so fast navigation cannot display a previous record.
export function useLoad(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const reload = useCallback(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    return api(path)
      .then((result) => {
        if (id === requestId.current) setData(result);
      })
      .catch((err) => {
        if (id === requestId.current) setError(err.message);
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [path]);

  useEffect(() => {
    setData(null);
    reload();
    return () => {
      requestId.current += 1;
    };
  }, [reload]);
  return { data, error, loading, reload };
}
