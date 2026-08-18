import type { AdminEvent } from '../../../types/adminEvent';
import { formatStatusDate } from '../../../utils/statusAggregation';

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

    try {
      return formatStatusDate(value);
    } catch {
      return '날짜 확인 필요';
    }
  };
  const startLabel = getDateLabel(startDate, '시작일 미정');
  const endLabel = getDateLabel(endDate, '종료일 미정');

  return `${startLabel} ~ ${endLabel}`;
}

function getEventState(event: AdminEvent | null) {
  if (!event) {
    return {
      label: '행사 없음',
      tone: 'unconfigured',
    } as const;
  }

  const today = new Date();
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  if (todayKey < event.eventStartDate) {
    return {
      label: '운영 예정',
      tone: 'upcoming',
    } as const;
  }

  if (todayKey > event.eventEndDate) {
    return {
      label: '운영 종료',
      tone: 'ended',
    } as const;
  }

  return {
    label: '운영 중',
    tone: 'active',
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
            {formatPeriod(
              event?.applicationStartDate ?? '',
              event?.applicationEndDate ?? '',
            )}
          </dd>
        </div>
        <div>
          <dt>운영</dt>
          <dd>
            {formatPeriod(
              event?.eventStartDate ?? '',
              event?.eventEndDate ?? '',
            )}
          </dd>
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
            : `${approvedPageTotal.toLocaleString('ko-KR')}쪽 · ${approvedDistanceMeters.toLocaleString('ko-KR')}m`}
        </small>
      </div>
    </section>
  );
}

export default DashboardEventOverview;
