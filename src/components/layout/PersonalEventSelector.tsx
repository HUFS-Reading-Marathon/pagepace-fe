import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getMyParticipations } from '../../api/participationApi';
import { selectEvent, selectedEventId } from '../../utils/eventSelection';
import type { MyParticipation } from '../../types/participation';
import { useAuth } from '../../auth';
export default function PersonalEventSelector() {
  const { isAuthenticated, user } = useAuth();
  const { pathname } = useLocation();
  const [items, setItems] = useState<MyParticipation[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    getMyParticipations()
      .then((next) => {
        if (active) {
          setItems(next);
          setError('');
        }
      })
      .catch(() => {
        if (active) setError('참가 회차 목록을 불러오지 못했습니다.');
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, user?.userId]);
  if (!isAuthenticated || !(pathname.startsWith('/my') || pathname.startsWith('/logs')))
    return null;
  return (
    <div className="wrap">
      <label>
        조회할 참가 회차{' '}
        <select
          aria-label="조회할 참가 회차"
          value={selectedEventId('personal') ?? ''}
          disabled={/\/logs\/\d+/.test(pathname)}
          onChange={(e) => selectEvent('personal', Number(e.target.value) || undefined)}
        >
          <option value="">현재 공개 행사</option>
          {items.map((item) => (
            <option key={item.participationId} value={item.eventId}>
              {item.eventTitle} · {item.courseName}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
