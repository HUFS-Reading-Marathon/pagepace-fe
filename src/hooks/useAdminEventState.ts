import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { selectEvent } from '../utils/eventSelection';
export function useAdminEventState(): [number | null, Dispatch<SetStateAction<number | null>>] {
  const [id, setId] = useState<number | null>(null);
  const change = useCallback<Dispatch<SetStateAction<number | null>>>((next) => {
    if (typeof next === 'function') {
      setId(next);
      return;
    }
    if (next !== null) selectEvent('admin', next);
    setId(next);
  }, []);
  return [id, change];
}
