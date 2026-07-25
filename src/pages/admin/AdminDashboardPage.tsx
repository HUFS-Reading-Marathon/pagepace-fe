import { useMemo, useState } from 'react';
import DashboardAffiliationChart from '../../components/admin/dashboard/DashboardAffiliationChart';
import DashboardCourseCompletion from '../../components/admin/dashboard/DashboardCourseCompletion';
import DashboardEventOverview from '../../components/admin/dashboard/DashboardEventOverview';
import DashboardGenderChart from '../../components/admin/dashboard/DashboardGenderChart';
import DashboardMetricCard from '../../components/admin/dashboard/DashboardMetricCard';
import DashboardPendingLogs from '../../components/admin/dashboard/DashboardPendingLogs';
import DashboardReadingTrend from '../../components/admin/dashboard/DashboardReadingTrend';
import DashboardRecentParticipants from '../../components/admin/dashboard/DashboardRecentParticipants';
import { ADMIN_PARTICIPANTS } from '../../mocks/adminParticipants';
import { ADMIN_READING_LOGS } from '../../mocks/adminReadingLogs';
import {
  DEFAULT_EVENT_SETTINGS,
  EVENT_SETTINGS_STORAGE_KEY,
  type EventSettings,
} from '../../types/adminEventSettings';
import { formatParticipantDateTime } from '../../types/adminParticipant';
import {
  getDashboardAnalytics,
  getLocalDateKey,
} from '../../utils/dashboardAnalytics';
import {
  buildStatusSnapshot,
  getStatusCourseSummaries,
} from '../../utils/statusAggregation';
import '../../styles/admin-dashboard.css';

function isEventSettings(value: unknown): value is EventSettings {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const settings = value as Partial<EventSettings>;
  const standards = settings.courseStandards;

  return (
    typeof settings.eventStartDate === 'string' &&
    typeof settings.eventEndDate === 'string' &&
    typeof settings.applyStartDate === 'string' &&
    typeof settings.applyEndDate === 'string' &&
    typeof settings.rewardStandard === 'string' &&
    Boolean(standards) &&
    typeof standards?.short === 'number' &&
    typeof standards.half === 'number' &&
    typeof standards.full === 'number'
  );
}

function readEventSettings() {
  try {
    const storedValue = window.localStorage.getItem(
      EVENT_SETTINGS_STORAGE_KEY,
    );

    if (!storedValue) {
      return DEFAULT_EVENT_SETTINGS;
    }

    const parsedValue: unknown = JSON.parse(storedValue);

    return isEventSettings(parsedValue)
      ? parsedValue
      : DEFAULT_EVENT_SETTINGS;
  } catch {
    return DEFAULT_EVENT_SETTINGS;
  }
}

function readDashboardSources(now = new Date()) {
  return {
    participants: [...ADMIN_PARTICIPANTS],
    logs: [...ADMIN_READING_LOGS],
    eventSettings: readEventSettings(),
    now,
  };
}

function getSubmissionComparison(todayCount: number, yesterdayCount: number) {
  const difference = todayCount - yesterdayCount;

  return `전일 대비 ${difference > 0 ? '+' : ''}${difference}건`;
}

function AdminDashboardPage() {
  const [dashboardSources, setDashboardSources] = useState(
    readDashboardSources,
  );
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(
    null,
  );
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const {
    participants,
    logs,
    eventSettings,
    now: dashboardNow,
  } = dashboardSources;
  const analytics = useMemo(
    () =>
      getDashboardAnalytics(
        participants,
        logs,
        dashboardNow,
      ),
    [dashboardNow, logs, participants],
  );
  const statusSnapshot = useMemo(
    () =>
      buildStatusSnapshot(
        participants,
        logs,
        getLocalDateKey(dashboardNow),
        eventSettings.courseStandards,
        {
          maskNames: true,
          showRanks: true,
        },
      ),
    [
      dashboardNow,
      eventSettings.courseStandards,
      logs,
      participants,
    ],
  );
  const courseSummaries = useMemo(
    () => getStatusCourseSummaries(statusSnapshot.participants),
    [statusSnapshot.participants],
  );
  const totalFinisherCount = courseSummaries.reduce(
    (sum, summary) => sum + summary.completedCount,
    0,
  );
  const approvedRate =
    analytics.totalApplicants > 0
      ? (analytics.approvedParticipants.length /
          analytics.totalApplicants) *
        100
      : 0;
  const reflectedAt = lastRefreshedAt ?? analytics.latestDataTimestamp;
  const latestDataLabel = reflectedAt
    ? formatParticipantDateTime(reflectedAt)
    : '반영 데이터 없음';
  const hasNoOperationData =
    analytics.totalApplicants === 0 && logs.length === 0;
  const refreshAnnouncement =
    refreshVersion > 0 && lastRefreshedAt
      ? `대시보드 데이터를 새로 반영했습니다. ${formatParticipantDateTime(
          lastRefreshedAt,
        )}`
      : '';

  const handleRefresh = () => {
    if (isRefreshing) {
      return;
    }

    const refreshedSources = readDashboardSources();
    const shouldAnimate = !window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    setDashboardSources(refreshedSources);
    setLastRefreshedAt(refreshedSources.now.toISOString());
    setRefreshVersion((version) => version + 1);
    setIsRefreshing(shouldAnimate);
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
          <span>최근 반영</span>
          <div className="admin-dashboard__header-meta-row">
            <strong>{latestDataLabel}</strong>
            <button
              type="button"
              className="admin-dashboard__refresh"
              aria-label="대시보드 데이터 새로고침"
              aria-busy={isRefreshing}
              title="최신 데이터 다시 반영"
              disabled={isRefreshing}
              onClick={handleRefresh}
            >
              <svg
                className={
                  isRefreshing
                    ? 'admin-dashboard__refresh-icon admin-dashboard__refresh-icon--spinning'
                    : 'admin-dashboard__refresh-icon'
                }
                viewBox="0 0 24 24"
                aria-hidden="true"
                onAnimationEnd={(event) => {
                  if (
                    event.animationName ===
                    'admin-dashboard-refresh-spin'
                  ) {
                    setIsRefreshing(false);
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

      {hasNoOperationData && (
        <div className="admin-dashboard__empty admin-dashboard__empty--page">
          아직 집계할 운영 데이터가 없습니다.
        </div>
      )}

      <DashboardEventOverview
        settings={eventSettings}
        approvedParticipantCount={analytics.approvedParticipants.length}
      />

      <section
        className="admin-dashboard__metrics"
        aria-label="핵심 운영 지표"
      >
        <DashboardMetricCard
          label="총 신청자"
          value={analytics.totalApplicants}
          unit="명"
          description={`승인 대기 ${analytics.pendingApplicantCount}명`}
          to="/admin/participants"
          linkLabel="참가자 관리"
          tone="navy"
        />
        <DashboardMetricCard
          label="승인 참가자"
          value={analytics.approvedParticipants.length}
          unit="명"
          description={`승인율 ${approvedRate.toFixed(1)}%`}
          to="/admin/participants"
          linkLabel="승인 현황 보기"
          tone="green"
        />
        <DashboardMetricCard
          label="오늘 제출"
          value={analytics.todaySubmissionCount}
          unit="건"
          description={getSubmissionComparison(
            analytics.todaySubmissionCount,
            analytics.yesterdaySubmissionCount,
          )}
          to="/admin/logs"
          linkLabel="독서일지 검토"
          tone="blue"
        />
        <DashboardMetricCard
          label="검토 대기"
          value={analytics.pendingLogs.length}
          unit="건"
          description={`확인 필요 ${analytics.warningPendingCount}건`}
          to="/admin/logs"
          linkLabel="대기 목록 보기"
          tone="gold"
        />
        <DashboardMetricCard
          label="총 완주자"
          value={totalFinisherCount}
          unit="명"
          description={courseSummaries
            .map(
              (summary) =>
                `${summary.courseName.replace('코스', '')} ${
                  summary.completedCount
                }`,
            )
            .join(' · ')}
          to="/admin/status"
          linkLabel="대회 현황 보기"
          tone="teal"
        />
      </section>

      <div className="admin-dashboard__grid admin-dashboard__grid--primary">
        <DashboardReadingTrend
          logs={logs}
          now={dashboardNow}
        />
        <DashboardCourseCompletion summaries={courseSummaries} />
      </div>

      <div className="admin-dashboard__grid admin-dashboard__grid--distribution">
        <DashboardGenderChart
          distribution={analytics.genderDistribution}
          participantCount={analytics.approvedParticipants.length}
        />
        <DashboardAffiliationChart
          distribution={analytics.affiliationDistribution}
          participantCount={analytics.approvedParticipants.length}
        />
      </div>

      <div className="admin-dashboard__grid admin-dashboard__grid--operations">
        <DashboardRecentParticipants
          participants={analytics.recentParticipants.slice(0, 4)}
        />
        <DashboardPendingLogs logs={analytics.pendingLogs.slice(0, 4)} />
      </div>
    </section>
  );
}

export default AdminDashboardPage;
