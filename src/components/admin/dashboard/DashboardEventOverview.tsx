import type { EventSettings } from '../../../types/adminEventSettings';
import { formatStatusDate } from '../../../utils/statusAggregation';

type DashboardEventOverviewProps = {
  settings: EventSettings;
  approvedParticipantCount: number;
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

function getEventState(settings: EventSettings) {
  const today = new Date();
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  if (!settings.eventStartDate && !settings.eventEndDate) {
    return {
      label: '설정 필요',
      tone: 'unconfigured',
    } as const;
  }

  if (settings.eventStartDate && todayKey < settings.eventStartDate) {
    return {
      label: '운영 예정',
      tone: 'upcoming',
    } as const;
  }

  if (settings.eventEndDate && todayKey > settings.eventEndDate) {
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
  settings,
  approvedParticipantCount,
}: DashboardEventOverviewProps) {
  const eventState = getEventState(settings);

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
          <strong id="dashboardEventOverviewTitle">행사명 미설정</strong>
        </div>
      </div>

      <dl className="admin-dashboard__event-periods">
        <div>
          <dt>신청</dt>
          <dd>
            {formatPeriod(
              settings.applyStartDate,
              settings.applyEndDate,
            )}
          </dd>
        </div>
        <div>
          <dt>운영</dt>
          <dd>
            {formatPeriod(
              settings.eventStartDate,
              settings.eventEndDate,
            )}
          </dd>
        </div>
      </dl>

      <div className="admin-dashboard__event-approved">
        <span>승인 참가자</span>
        <p>
          <strong>{approvedParticipantCount.toLocaleString('ko-KR')}</strong>
          <small>명</small>
        </p>
      </div>
    </section>
  );
}

export default DashboardEventOverview;
