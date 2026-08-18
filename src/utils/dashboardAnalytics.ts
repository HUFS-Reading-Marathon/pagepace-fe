import type { AdminApplicationListItem } from '../types/adminApplication';
import type { AdminReadingLogResponse } from '../types/adminReadingLogApi';

export type DashboardDistributionItem = {
  label: string;
  count: number;
  rate: number;
};

export type DashboardDailyActivity = {
  date: string;
  label: string;
  approvedPages: number;
  submissionCount: number;
};

export type DashboardAnalytics = {
  totalApplicants: number;
  pendingApplicantCount: number;
  approvedApplications: AdminApplicationListItem[];
  todaySubmissionCount: number;
  yesterdaySubmissionCount: number;
  pendingLogs: AdminReadingLogResponse[];
  warningPendingCount: number;
  approvedPageTotal: number;
  approvedDistanceMeters: number;
  affiliationDistribution: DashboardDistributionItem[];
  recentApplications: AdminApplicationListItem[];
};

function getValidTime(value: string) {
  const time = new Date(value).getTime();

  return Number.isFinite(time) ? time : null;
}

export function getSeoulDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getSeoulDateKeyFromValue(value: string) {
  const time = getValidTime(value);

  return time === null ? null : getSeoulDateKey(new Date(time));
}

function addDaysToDateKey(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));

  return date.toISOString().slice(0, 10);
}

function getRate(count: number, total: number) {
  return total > 0 ? (count / total) * 100 : 0;
}

function getDistribution(labels: string[]): DashboardDistributionItem[] {
  const counts = labels.reduce<Map<string, number>>((result, label) => {
    result.set(label, (result.get(label) ?? 0) + 1);
    return result;
  }, new Map());
  const total = labels.length;

  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      rate: getRate(count, total),
    }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.label.localeCompare(right.label, 'ko-KR'),
    );
}

function hasServerWarning(log: AdminReadingLogResponse) {
  return (
    (log.recommendedRejectReasons?.length ?? 0) > 0 ||
    log.books.some(
      (book) =>
        book.pageExceeded || Boolean(book.warningMessage?.trim()),
    )
  );
}

export function getDailyActivity(
  logs: ReadonlyArray<AdminReadingLogResponse>,
  days: number,
  now = new Date(),
): DashboardDailyActivity[] {
  const safeDays = Math.max(1, Math.floor(days));
  const todayKey = getSeoulDateKey(now);
  const dates = Array.from({ length: safeDays }, (_, index) => {
    const date = addDaysToDateKey(todayKey, index - safeDays + 1);
    const [, month, day] = date.split('-').map(Number);

    return { date, label: `${month}.${day}` };
  });

  return dates.map(({ date, label }) => ({
    date,
    label,
    approvedPages: logs
      .filter((log) => log.status === 'APPROVED' && log.readingDate === date)
      .reduce((sum, log) => sum + log.totalReadPages, 0),
    submissionCount: logs.filter(
      (log) => getSeoulDateKeyFromValue(log.createdAt) === date,
    ).length,
  }));
}

function getAffiliationDistribution(
  applications: ReadonlyArray<AdminApplicationListItem>,
  visibleLimit = 5,
) {
  const distribution = getDistribution(
    applications.map(
      (application) => application.department?.trim() || '미입력',
    ),
  );
  const safeLimit = Math.max(1, Math.floor(visibleLimit));

  if (distribution.length <= safeLimit) {
    return distribution;
  }

  const visibleItems = distribution.slice(0, safeLimit);
  const otherCount = distribution
    .slice(safeLimit)
    .reduce((sum, item) => sum + item.count, 0);

  return [
    ...visibleItems,
    {
      label: '기타',
      count: otherCount,
      rate: getRate(otherCount, applications.length),
    },
  ];
}

export function getDashboardAnalytics(
  applications: ReadonlyArray<AdminApplicationListItem>,
  logs: ReadonlyArray<AdminReadingLogResponse>,
  now = new Date(),
): DashboardAnalytics {
  const todayKey = getSeoulDateKey(now);
  const yesterdayKey = addDaysToDateKey(todayKey, -1);
  const approvedApplications = applications.filter(
    (application) => application.status === 'APPROVED',
  );
  const pendingLogs = logs
    .filter((log) => log.status === 'SUBMITTED')
    .sort(
      (left, right) =>
        (getValidTime(right.createdAt) ?? 0) -
          (getValidTime(left.createdAt) ?? 0) ||
        left.readingLogId - right.readingLogId,
    );
  const approvedLogs = logs.filter((log) => log.status === 'APPROVED');

  return {
    totalApplicants: applications.length,
    pendingApplicantCount: applications.filter(
      (application) => application.status === 'APPLIED',
    ).length,
    approvedApplications,
    todaySubmissionCount: logs.filter(
      (log) => getSeoulDateKeyFromValue(log.createdAt) === todayKey,
    ).length,
    yesterdaySubmissionCount: logs.filter(
      (log) => getSeoulDateKeyFromValue(log.createdAt) === yesterdayKey,
    ).length,
    pendingLogs,
    warningPendingCount: pendingLogs.filter(hasServerWarning).length,
    approvedPageTotal: approvedLogs.reduce(
      (sum, log) => sum + log.totalReadPages,
      0,
    ),
    approvedDistanceMeters: approvedLogs.reduce(
      (sum, log) => sum + log.convertedDistanceMeter,
      0,
    ),
    affiliationDistribution: getAffiliationDistribution(
      approvedApplications,
    ),
    recentApplications: [...applications]
      .sort(
        (left, right) =>
          (getValidTime(right.appliedAt) ?? 0) -
            (getValidTime(left.appliedAt) ?? 0) ||
          left.applicationId - right.applicationId,
      )
      .slice(0, 5),
  };
}
