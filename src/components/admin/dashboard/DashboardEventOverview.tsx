import { EVENT_STATUS_LABELS, type AdminEvent, type EventStatus } from '../../../types/adminEvent';
import { formatKoDateKey } from '../../../utils/date';

type DashboardEventOverviewProps = {
  event: AdminEvent | null;
  approvedParticipantCount: number | null;
  approvedPageTotal: number | null;
  approvedDistanceMeters: number | null;
};

function formatPeriod(startDate: string, endDate: string) {
  if (!startDate && !endDate) {
    return '미설정';
  }

  const getDateLabel = (value: string, fallback: string) => {
    if (!value) {
      return fallback;
    }

    const label = formatKoDateKey(value);

    return label === '-' ? '날짜 확인 필요' : label;
  };
  const startLabel = getDateLabel(startDate, '시작일 미정');
  const endLabel = getDateLabel(endDate, '종료일 미정');

  return `${startLabel} ~ ${endLabel}`;
}

/** 서버 행사 상태를 배지 색 구분으로 묶습니다. 라벨은 관리자 홈·행사 설정과 같은 EVENT_STATUS_LABELS를 씁니다. */
const EVENT_STATE_TONE: Record<EventStatus, 'upcoming' | 'active' | 'ended'> = {
  DRAFT: 'upcoming',
  READY: 'upcoming',
  APPLICATION_OPEN: 'active',
  APPLICATION_CLOSED: 'active',
  IN_PROGRESS: 'active',
  ENDED: 'ended',
  FINALIZED: 'ended',
  ARCHIVED: 'ended',
};

function getEventState(event: AdminEvent | null) {
  if (!event) {
    return {
      label: '행사 없음',
      tone: 'unconfigured',
    } as const;
  }

  return {
    label: EVENT_STATUS_LABELS[event.status] ?? event.status,
    tone: EVENT_STATE_TONE[event.status] ?? 'active',
  } as const;
}

function DashboardEventOverview({
  event,
  approvedParticipantCount,
  approvedPageTotal,
  approvedDistanceMeters,
}: DashboardEventOverviewProps) {
  const eventState = getEventState(event);

  return (
    <section
      className="admin-dashboard__event-overview admin-dashboard__enter"
      aria-labelledby="dashboardEventOverviewTitle"
    >
      <div className="admin-dashboard__event-primary">
        <span
          className={`admin-dashboard__event-state admin-dashboard__event-state--${eventState.tone}`}
        >
          {eventState.label}
        </span>
        <div>
          <span>행사 운영</span>
          <strong id="dashboardEventOverviewTitle">
            {event ? `${event.roundNo}회 · ${event.title}` : '등록된 행사 없음'}
          </strong>
        </div>
      </div>

      <dl className="admin-dashboard__event-periods">
        <div>
          <dt>신청</dt>
          <dd>
            {formatPeriod(event?.applicationStartDate ?? '', event?.applicationEndDate ?? '')}
          </dd>
        </div>
        <div>
          <dt>운영</dt>
          <dd>{formatPeriod(event?.eventStartDate ?? '', event?.eventEndDate ?? '')}</dd>
        </div>
      </dl>

      <div className="admin-dashboard__event-approved">
        <span>승인 누적</span>
        <p>
          <strong>
            {approvedParticipantCount === null
              ? '—'
              : approvedParticipantCount.toLocaleString('ko-KR')}
          </strong>
          {approvedParticipantCount !== null && <small>명</small>}
        </p>
        <small>
          {approvedPageTotal === null || approvedDistanceMeters === null
            ? '데이터를 불러오는 중'
            : `승인 ${approvedPageTotal.toLocaleString('ko-KR')}쪽 · 인정 ${approvedDistanceMeters.toLocaleString('ko-KR')}m`}
        </small>
        <small>인정 거리는 서평 확인분 기준</small>
      </div>
    </section>
  );
}

export default DashboardEventOverview;
