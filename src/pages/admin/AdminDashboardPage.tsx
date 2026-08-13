import { useEffect, useMemo, useRef, useState } from 'react';
import { getAdminApplications } from '../../api/adminApplicationApi';
import { ApiError } from '../../api/apiClient';
import { getAdminEvents } from '../../api/adminEventApi';
import { getAdminReadingLogs } from '../../api/adminReadingLogApi';
import DashboardAffiliationChart from '../../components/admin/dashboard/DashboardAffiliationChart';
import DashboardCourseCompletion from '../../components/admin/dashboard/DashboardCourseCompletion';
import DashboardEventOverview from '../../components/admin/dashboard/DashboardEventOverview';
import DashboardGenderChart from '../../components/admin/dashboard/DashboardGenderChart';
import DashboardMetricCard from '../../components/admin/dashboard/DashboardMetricCard';
import DashboardPendingLogs from '../../components/admin/dashboard/DashboardPendingLogs';
import DashboardReadingTrend from '../../components/admin/dashboard/DashboardReadingTrend';
import DashboardRecentParticipants from '../../components/admin/dashboard/DashboardRecentParticipants';
import type { AdminApplicationListItem } from '../../types/adminApplication';
import type { AdminEvent, EventStatus } from '../../types/adminEvent';
import type { AdminReadingLogResponse } from '../../types/adminReadingLogApi';
import { formatParticipantDateTime } from '../../types/adminParticipant';
import { getDashboardAnalytics } from '../../utils/dashboardAnalytics';
import '../../styles/admin-dashboard.css';

type DashboardData = {
  applications: AdminApplicationListItem[];
  logs: AdminReadingLogResponse[];
  fetchedAt: Date;
};

const EVENT_SELECTION_ORDER: EventStatus[] = [
  'IN_PROGRESS',
  'APPLICATION_OPEN',
  'APPLICATION_CLOSED',
  'READY',
  'DRAFT',
  'ENDED',
  'FINALIZED',
  'ARCHIVED',
];

function chooseEventId(events: AdminEvent[]) {
  for (const status of EVENT_SELECTION_ORDER) {
    const event = events.find((item) => item.status === status);

    if (event) {
      return event.eventId;
    }
  }

  return events[0]?.eventId ?? null;
}

function getApiErrorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : '대시보드 데이터를 불러오지 못했습니다.';
}

function getSubmissionComparison(todayCount: number, yesterdayCount: number) {
  const difference = todayCount - yesterdayCount;

  return `전일 대비 ${difference > 0 ? '+' : ''}${difference}건`;
}

function requestDashboardData(eventId: number) {
  return Promise.all([
    getAdminApplications(eventId),
    getAdminReadingLogs({ eventId }),
  ]).then(([applications, logs]) => ({
    applications,
    logs,
    fetchedAt: new Date(),
  }));
}

function AdminDashboardPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isEventsLoading, setIsEventsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isRefreshIconSpinning, setIsRefreshIconSpinning] = useState(false);
  const [pageError, setPageError] = useState('');
  const [refreshAnnouncement, setRefreshAnnouncement] = useState('');
  const initialEventsRequestRef = useRef<Promise<AdminEvent[]> | null>(null);
  const dataRequestRef = useRef<{
    eventId: number;
    promise: Promise<DashboardData>;
  } | null>(null);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    let isActive = true;

    if (initialEventsRequestRef.current === null) {
      initialEventsRequestRef.current = getAdminEvents();
    }

    initialEventsRequestRef.current
      .then((nextEvents) => {
        if (!isActive) {
          return;
        }

        const nextEventId = chooseEventId(nextEvents);

        setEvents(nextEvents);
        setDashboardData(null);
        setIsDataLoading(nextEventId !== null);
        setSelectedEventId(nextEventId);
        setPageError('');
      })
      .catch((error: unknown) => {
        if (isActive) {
          setPageError(getApiErrorMessage(error));
        }
      })
      .finally(() => {
        if (isActive) {
          setIsEventsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (selectedEventId === null) {
      return;
    }

    let isActive = true;
    const sequence = ++requestSequenceRef.current;

    if (
      dataRequestRef.current === null ||
      dataRequestRef.current.eventId !== selectedEventId
    ) {
      dataRequestRef.current = {
        eventId: selectedEventId,
        promise: requestDashboardData(selectedEventId),
      };
    }

    const request = dataRequestRef.current;

    request.promise
      .then((data) => {
        if (isActive && requestSequenceRef.current === sequence) {
          setDashboardData(data);
          setPageError('');
        }
      })
      .catch((error: unknown) => {
        if (isActive && requestSequenceRef.current === sequence) {
          setDashboardData(null);
          setPageError(getApiErrorMessage(error));
        }
      })
      .finally(() => {
        if (dataRequestRef.current === request) {
          dataRequestRef.current = null;
        }

        if (isActive && requestSequenceRef.current === sequence) {
          setIsDataLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [selectedEventId]);

  const selectedEvent = useMemo(
    () =>
      events.find((event) => event.eventId === selectedEventId) ?? null,
    [events, selectedEventId],
  );
  const analytics = useMemo(
    () =>
      dashboardData
        ? getDashboardAnalytics(
            dashboardData.applications,
            dashboardData.logs,
            dashboardData.fetchedAt,
          )
        : null,
    [dashboardData],
  );
  const approvedRate =
    analytics && analytics.totalApplicants > 0
      ? (analytics.approvedApplications.length / analytics.totalApplicants) *
        100
      : 0;
  const latestDataLabel = dashboardData
    ? formatParticipantDateTime(dashboardData.fetchedAt.toISOString())
    : isDataLoading
      ? '불러오는 중'
      : '반영 데이터 없음';
  const isBusy =
    isEventsLoading || isDataLoading || isRefreshIconSpinning;
  const hasNoOperationData =
    Boolean(analytics) &&
    analytics?.totalApplicants === 0 &&
    dashboardData?.logs.length === 0;

  const handleRefresh = async () => {
    if (selectedEventId === null || isBusy) {
      return;
    }

    const eventId = selectedEventId;
    const sequence = ++requestSequenceRef.current;
    const shouldAnimate = !window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    setIsDataLoading(true);
    setIsRefreshIconSpinning(shouldAnimate);
    setPageError('');
    setRefreshAnnouncement('');

    try {
      const data = await requestDashboardData(eventId);

      if (requestSequenceRef.current !== sequence) {
        return;
      }

      setDashboardData(data);
      setRefreshAnnouncement(
        `대시보드 데이터를 새로 반영했습니다. ${formatParticipantDateTime(
          data.fetchedAt.toISOString(),
        )}`,
      );
    } catch (error: unknown) {
      if (requestSequenceRef.current === sequence) {
        const message = getApiErrorMessage(error);

        setDashboardData(null);
        setPageError(message);
        setRefreshAnnouncement(`새로고침에 실패했습니다. ${message}`);
      }
    } finally {
      if (requestSequenceRef.current === sequence) {
        setIsDataLoading(false);
      }

      if (!shouldAnimate) {
        setIsRefreshIconSpinning(false);
      }
    }
  };

  return (
    <section className="admin-page admin-dashboard">
      <header className="admin-page__header admin-dashboard__header admin-dashboard__enter admin-dashboard__enter--header">
        <div className="admin-dashboard__heading">
          <h1>관리자 대시보드</h1>
          <p>
            독서마라톤의 참가, 독서 기록, 완주 현황을 한눈에
            확인합니다.
          </p>
        </div>
        <div className="admin-dashboard__header-meta">
          <label className="admin-dashboard__event-select">
            <span>관리 행사</span>
            <select
              value={selectedEventId ?? ''}
              disabled={isEventsLoading || events.length === 0}
              onChange={(event) => {
                const eventId = Number(event.target.value);

                requestSequenceRef.current += 1;
                setDashboardData(null);
                setIsDataLoading(true);
                setPageError('');
                setRefreshAnnouncement('');
                setSelectedEventId(eventId);
              }}
            >
              {events.length === 0 && <option value="">등록된 행사 없음</option>}
              {events.map((event) => (
                <option key={event.eventId} value={event.eventId}>
                  {event.roundNo}회 · {event.title}
                </option>
              ))}
            </select>
          </label>
          <span>최근 반영</span>
          <div className="admin-dashboard__header-meta-row">
            <strong>{latestDataLabel}</strong>
            <button
              type="button"
              className="admin-dashboard__refresh"
              aria-label="대시보드 데이터 새로고침"
              aria-busy={isBusy}
              title="최신 데이터 다시 반영"
              disabled={isBusy || selectedEventId === null}
              onClick={handleRefresh}
            >
              <svg
                className={
                  isRefreshIconSpinning
                    ? 'admin-dashboard__refresh-icon admin-dashboard__refresh-icon--spinning'
                    : 'admin-dashboard__refresh-icon'
                }
                viewBox="0 0 24 24"
                aria-hidden="true"
                onAnimationEnd={(event) => {
                  if (
                    event.animationName === 'admin-dashboard-refresh-spin'
                  ) {
                    setIsRefreshIconSpinning(false);
                  }
                }}
              >
                <path d="M20 11a8 8 0 0 0-14.9-4M4 4v5h5" />
                <path d="M4 13a8 8 0 0 0 14.9 4M20 20v-5h-5" />
              </svg>
            </button>
          </div>
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {refreshAnnouncement}
          </span>
        </div>
      </header>

      {pageError && (
        <div className="admin-dashboard__empty admin-dashboard__empty--page" role="alert">
          {pageError}
        </div>
      )}

      {isDataLoading && (
        <div
          className="admin-dashboard__empty admin-dashboard__empty--page"
          role="status"
        >
          선택한 행사의 운영 데이터를 불러오는 중입니다.
        </div>
      )}

      {!isEventsLoading && events.length === 0 && !pageError && (
        <div className="admin-dashboard__empty admin-dashboard__empty--page">
          관리할 행사가 없습니다. 행사/코스 설정에서 행사를 등록해 주세요.
        </div>
      )}

      {hasNoOperationData && (
        <div className="admin-dashboard__empty admin-dashboard__empty--page">
          선택한 행사에 아직 집계할 운영 데이터가 없습니다.
        </div>
      )}

      <DashboardEventOverview
        event={selectedEvent}
        approvedParticipantCount={
          analytics?.approvedApplications.length ?? null
        }
        approvedPageTotal={analytics?.approvedPageTotal ?? null}
        approvedDistanceMeters={analytics?.approvedDistanceMeters ?? null}
      />

      <section className="admin-dashboard__metrics" aria-label="핵심 운영 지표">
        <DashboardMetricCard
          label="총 신청자"
          value={analytics?.totalApplicants ?? null}
          unit="명"
          description={
            analytics ? `승인 대기 ${analytics.pendingApplicantCount}명` : '서버 집계 대기'
          }
          to="/admin/participants"
          linkLabel="참가자 관리"
          tone="navy"
        />
        <DashboardMetricCard
          label="승인 참가자"
          value={analytics?.approvedApplications.length ?? null}
          unit="명"
          description={analytics ? `승인율 ${approvedRate.toFixed(1)}%` : '서버 집계 대기'}
          to="/admin/participants"
          linkLabel="승인 현황 보기"
          tone="green"
        />
        <DashboardMetricCard
          label="오늘 제출"
          value={analytics?.todaySubmissionCount ?? null}
          unit="건"
          description={
            analytics
              ? getSubmissionComparison(
                  analytics.todaySubmissionCount,
                  analytics.yesterdaySubmissionCount,
                )
              : '서버 집계 대기'
          }
          to="/admin/logs"
          linkLabel="독서일지 검토"
          tone="blue"
        />
        <DashboardMetricCard
          label="검토 대기"
          value={analytics?.pendingLogs.length ?? null}
          unit="건"
          description={
            analytics ? `서버 경고 ${analytics.warningPendingCount}건` : '서버 집계 대기'
          }
          to="/admin/logs"
          linkLabel="대기 목록 보기"
          tone="gold"
        />
        <DashboardMetricCard
          label="총 완주자"
          value={null}
          unit="명"
          description="백엔드 완주 집계 API 필요"
          to="/admin/status"
          linkLabel="대회 현황 보기"
          tone="teal"
        />
      </section>

      <div className="admin-dashboard__grid admin-dashboard__grid--primary">
        <DashboardReadingTrend
          logs={dashboardData?.logs ?? []}
          now={dashboardData?.fetchedAt ?? new Date()}
        />
        <DashboardCourseCompletion summaries={[]} isSupported={false} />
      </div>

      <div className="admin-dashboard__grid admin-dashboard__grid--distribution">
        <DashboardGenderChart
          distribution={[]}
          participantCount={analytics?.approvedApplications.length ?? 0}
          isSupported={false}
        />
        <DashboardAffiliationChart
          distribution={analytics?.affiliationDistribution ?? []}
          participantCount={analytics?.approvedApplications.length ?? 0}
        />
      </div>

      <div className="admin-dashboard__grid admin-dashboard__grid--operations">
        <DashboardRecentParticipants
          participants={analytics?.recentApplications.slice(0, 4) ?? []}
        />
        <DashboardPendingLogs logs={analytics?.pendingLogs.slice(0, 4) ?? []} />
      </div>

    </section>
  );
}

export default AdminDashboardPage;
