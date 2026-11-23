import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getMyParticipations } from '../../api/participationApi';
import { selectEvent, selectedEventId } from '../../utils/eventSelection';
import type { MyParticipation } from '../../types/participation';
import { useAuth } from '../../auth';

/** 회차 선택이 의미 있는 화면: 나의 현황, 나의 서재, 독서일지 작성 (상세·수정·계정 설정 제외) */
const SELECTOR_PATHS = ['/my', '/logs', '/logs/new', '/book-requests'];

/** 현재 공개 행사로 볼 수 있는 상태. 이 상태의 참가 1건뿐이면 '현재 공개 행사'와 같은 대상이라 선택이 필요 없습니다. */
const CURRENT_EVENT_STATUSES = ['APPLICATION_OPEN', 'APPLICATION_CLOSED', 'IN_PROGRESS'];

/** 같은 행사의 참가 기록이 여러 건이어도 선택지는 행사당 하나만 둡니다. */
function uniqueByEvent(items: MyParticipation[]) {
  return items.filter(
    (item, index) => items.findIndex((other) => other.eventId === item.eventId) === index,
  );
}

/**
 * 선택지가 실제로 다른 결과를 낼 때만 보여 줍니다.
 * - 참가한 행사가 2개 이상이거나
 * - 이미 다른 회차를 선택해 둔 상태(현재 행사로 되돌아갈 수 있어야 함)이거나
 * - 참가 기록이 지난 행사 1건뿐이라 '현재 공개 행사'로는 조회되지 않을 수 있는 경우
 */
function shouldShowSelector(items: MyParticipation[], selectedId: number | undefined) {
  if (selectedId !== undefined) return true;
  if (items.length >= 2) return true;
  return items.length === 1 && !CURRENT_EVENT_STATUSES.includes(items[0].eventStatus);
}

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
          setItems(uniqueByEvent(next));
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
  const selectedId = selectedEventId('personal');
  if (!isAuthenticated || !SELECTOR_PATHS.includes(pathname)) return null;
  if (!error && !shouldShowSelector(items, selectedId)) return null;
  return (
    <div className="wrap personal-event-selector">
      {!error && (
        <label>
          조회할 참가 회차{' '}
          <select
            aria-label="조회할 참가 회차"
            value={selectedId ?? ''}
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
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
