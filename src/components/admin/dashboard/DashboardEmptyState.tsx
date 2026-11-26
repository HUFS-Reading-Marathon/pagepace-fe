import type { EventStatus } from '../../../types/adminEvent';
import {
  getEmptyCopy,
  type DashboardEmptyIcon,
  type DashboardEmptyKind,
} from './dashboardEmptyCopy';

/** 기존 대시보드 아이콘과 같은 라인 스타일(24px 격자, 1.6 선 굵기) */
function EmptyIcon({ icon }: { icon: DashboardEmptyIcon }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {icon === 'calendar' && (
        <>
          <rect x="4" y="5.5" width="16" height="14" rx="2" />
          <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
        </>
      )}
      {icon === 'inbox' && (
        <>
          <path d="M4 13.5 6.5 6.5h11l2.5 7V18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
          <path d="M4 13.5h4.5a3.5 3.5 0 0 0 7 0H20" />
        </>
      )}
      {icon === 'bars' && <path d="M5 20V11M12 20V4M19 20v-6" />}
      {icon === 'group' && (
        <>
          <circle cx="9" cy="8.5" r="3" />
          <path d="M3.5 19c0-3.3 2.4-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
          <circle cx="17" cy="9.5" r="2.4" />
          <path d="M16.5 14c2.7 0 4.5 1.7 4.5 4.5" />
        </>
      )}
    </svg>
  );
}

/**
 * 운영 통계의 빈 상태: 작은 라인 아이콘 + 제목 + 설명. 문구는 실제 행사 상태(시작 전·진행 중·종료)에 맞춥니다.
 * page는 화면 상단 안내(가로), 그 밖에는 카드 안 가운데 안내입니다.
 */
function DashboardEmptyState({
  kind,
  eventStatus,
}: {
  kind: DashboardEmptyKind;
  eventStatus: EventStatus | string | null | undefined;
}) {
  const { icon, title, description } = getEmptyCopy(kind, eventStatus);

  return (
    <div
      className={`admin-dashboard__empty-state admin-dashboard__empty-state--${kind}`}
      role="status"
    >
      <span className="admin-dashboard__empty-icon">
        <EmptyIcon icon={icon} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default DashboardEmptyState;
