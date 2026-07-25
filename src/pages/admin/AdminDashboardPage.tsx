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

function getSubmissionComparison(todayCount: number, yesterdayCount: number) {
  const difference = todayCount - yesterdayCount;

  if (difference === 0) {
    return '전일과 동일';
  }

  return `전일 대비 ${difference > 0 ? '+' : ''}${difference}건`;
}

function AdminDashboardPage() {
  const [eventSettings] = useState(readEventSettings);
  const [dashboardNow] = useState(() => new Date());
  const analytics = useMemo(
    () =>
      getDashboardAnalytics(
        ADMIN_PARTICIPANTS,
        ADMIN_READING_LOGS,
        dashboardNow,
      ),
    [dashboardNow],
  );
  const statusSnapshot = useMemo(
    () =>
      buildStatusSnapshot(
        ADMIN_PARTICIPANTS,
        ADMIN_READING_LOGS,
        getLocalDateKey(dashboardNow),
        eventSettings.courseStandards,
        {
          maskNames: true,
          showRanks: true,
        },
      ),
    [dashboardNow, eventSettings.courseStandards],
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
  const latestDataLabel = analytics.latestDataTimestamp
    ? formatParticipantDateTime(analytics.latestDataTimestamp)
    : '반영 데이터 없음';
  const hasNoOperationData =
    analytics.totalApplicants === 0 && ADMIN_READING_LOGS.length === 0;

  return (
    <section className="admin-page admin-dashboard">
      <header className="admin-page__header admin-dashboard__header">
        <div className="admin-dashboard__heading">
          <h1>관리자 대시보드</h1>
          <p>
            독서마라톤의 참가, 독서 기록, 완주 현황을 한눈에
            확인합니다.
          </p>
        </div>
        <div className="admin-dashboard__header-meta">
          <span>최근 반영</span>
          <strong>{latestDataLabel}</strong>
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
        approvedPageTotal={analytics.approvedPageTotal}
        approvedDistanceMeters={analytics.approvedDistanceMeters}
        latestDataTimestamp={analytics.latestDataTimestamp}
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
          description={`전체 신청 대비 ${approvedRate.toFixed(1)}%`}
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
          logs={ADMIN_READING_LOGS}
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
          participants={analytics.recentParticipants}
        />
        <DashboardPendingLogs logs={analytics.pendingLogs.slice(0, 5)} />
      </div>

      <p className="admin-dashboard__data-note admin-dashboard__enter">
        대시보드는 관리자 참가자·독서일지 원본 mock을 읽기 전용으로
        집계합니다. 승인 누적은 제출·반려 일지를 제외합니다.
      </p>
    </section>
  );
}

export default AdminDashboardPage;
