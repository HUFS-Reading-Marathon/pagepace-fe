import type { EventSettings } from '../../../types/adminEventSettings';
import { formatParticipantDateTime } from '../../../types/adminParticipant';
import {
  formatStatusDate,
  formatStatusDistance,
} from '../../../utils/statusAggregation';

type DashboardEventOverviewProps = {
  settings: EventSettings;
  approvedParticipantCount: number;
  approvedPageTotal: number;
  approvedDistanceMeters: number;
  latestDataTimestamp: string | null;
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
  approvedPageTotal,
  approvedDistanceMeters,
  latestDataTimestamp,
}: DashboardEventOverviewProps) {
  const eventState = getEventState(settings);
  const hasEventSettings =
    Boolean(settings.eventStartDate) || Boolean(settings.eventEndDate);

  return (
    <section
      className="admin-dashboard__event-overview admin-dashboard__enter"
      aria-labelledby="dashboardEventOverviewTitle"
    >
      <div className="admin-dashboard__event-title">
        <div>
          <span>행사 운영 요약</span>
          <strong id="dashboardEventOverviewTitle">
            {hasEventSettings
              ? '독서마라톤 운영 정보'
              : '행사 설정 정보가 없습니다.'}
          </strong>
        </div>
        <span
          className={`admin-dashboard__event-state admin-dashboard__event-state--${eventState.tone}`}
        >
          {eventState.label}
        </span>
      </div>

      <dl className="admin-dashboard__event-details">
        <div>
          <dt>신청 기간</dt>
          <dd>
            {formatPeriod(
              settings.applyStartDate,
              settings.applyEndDate,
            )}
          </dd>
        </div>
        <div>
          <dt>운영 기간</dt>
          <dd>
            {formatPeriod(
              settings.eventStartDate,
              settings.eventEndDate,
            )}
          </dd>
        </div>
        <div>
          <dt>승인 참가자</dt>
          <dd>{approvedParticipantCount.toLocaleString('ko-KR')}명</dd>
        </div>
        <div>
          <dt>승인 누적 독서량</dt>
          <dd>
            {approvedPageTotal.toLocaleString('ko-KR')}쪽 ·{' '}
            {formatStatusDistance(approvedDistanceMeters)}
          </dd>
        </div>
        <div>
          <dt>최근 데이터 반영</dt>
          <dd>
            {latestDataTimestamp
              ? formatParticipantDateTime(latestDataTimestamp)
              : '반영 데이터 없음'}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export default DashboardEventOverview;
