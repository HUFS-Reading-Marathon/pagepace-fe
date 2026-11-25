import { Link } from 'react-router-dom';
import type { CurrentEvent } from '../../api/eventApi';
import { useAuth } from '../../auth';
import {
  getApplicationAvailability,
  getApplicationClosedMessage,
} from '../../utils/eventSelection';

/**
 * 안내 페이지 하단의 참가신청 연결. 메인페이지와 같은 기준(행사 신청기간·상태)으로
 * 신청 가능하면 참가신청, 아니면 마감 안내와 대회 현황으로 연결합니다.
 */
export default function EventApplyCta({
  currentEvent,
  loaded,
}: {
  currentEvent: CurrentEvent | null;
  loaded: boolean;
}) {
  const { isAuthenticated } = useAuth();
  if (!loaded) return null;
  const availability = getApplicationAvailability(currentEvent);
  const closedMessage =
    availability.state === 'open' ? null : getApplicationClosedMessage(availability);

  return (
    <div className="user-page__cta">
      <p>{closedMessage ?? `${currentEvent?.title ?? '독서마라톤'} 참가신청을 받고 있습니다.`}</p>
      {closedMessage ? (
        <Link className="btn btn-secondary" to={isAuthenticated ? '/status' : '/login'}>
          {isAuthenticated ? '대회 현황 보기' : '로그인'}
        </Link>
      ) : (
        <Link className="btn btn-navy" to="/apply">
          참가신청하기
        </Link>
      )}
    </div>
  );
}
