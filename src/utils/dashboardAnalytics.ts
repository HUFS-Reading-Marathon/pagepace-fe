import type { AdminParticipant } from '../types/adminParticipant';
import {
  getReadingLogTotalPages,
  validateReadingLog,
  type AdminReadingLog,
} from '../types/adminReadingLog';

export type DashboardParticipant = AdminParticipant & {
  gender?: string | null;
};

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
  approvedParticipants: DashboardParticipant[];
  todaySubmissionCount: number;
  yesterdaySubmissionCount: number;
  pendingLogs: AdminReadingLog[];
  warningPendingCount: number;
  approvedPageTotal: number;
  approvedDistanceMeters: number;
  genderDistribution: DashboardDistributionItem[];
  affiliationDistribution: DashboardDistributionItem[];
  recentParticipants: DashboardParticipant[];
  latestDataTimestamp: string | null;
};

function getValidTime(value: string) {
  const time = new Date(value).getTime();

  return Number.isFinite(time) ? time : null;
}

export function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getLocalDateKeyFromValue(value: string) {
  const time = getValidTime(value);

  return time === null ? null : getLocalDateKey(new Date(time));
}

function getRate(count: number, total: number) {
  return total > 0 ? (count / total) * 100 : 0;
}

function getDistribution(
  labels: string[],
): DashboardDistributionItem[] {
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
      (firstItem, secondItem) =>
        secondItem.count - firstItem.count ||
        firstItem.label.localeCompare(secondItem.label, 'ko-KR'),
    );
}

export function getApprovedParticipants(
  participants: ReadonlyArray<DashboardParticipant>,
) {
  return participants.filter(
    (participant) => participant.applicationStatus === 'APPROVED',
  );
}

export function getTodaySubmittedLogs(
  logs: ReadonlyArray<AdminReadingLog>,
  now = new Date(),
) {
  const todayKey = getLocalDateKey(now);

  return logs.filter(
    (log) => getLocalDateKeyFromValue(log.submittedAt) === todayKey,
  );
}

export function getPreviousDaySubmittedLogs(
  logs: ReadonlyArray<AdminReadingLog>,
  now = new Date(),
) {
  const previousDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  );
  const previousDayKey = getLocalDateKey(previousDay);

  return logs.filter(
    (log) =>
      getLocalDateKeyFromValue(log.submittedAt) === previousDayKey,
  );
}

export function getPendingReviewLogs(
  logs: ReadonlyArray<AdminReadingLog>,
) {
  return logs.filter((log) => log.status === 'submit');
}

export function getApprovedPageTotal(
  logs: ReadonlyArray<AdminReadingLog>,
) {
  return logs
    .filter((log) => log.status === 'approve')
    .reduce((total, log) => total + getReadingLogTotalPages(log), 0);
}

export function getDailyActivity(
  logs: ReadonlyArray<AdminReadingLog>,
  days: number,
  now = new Date(),
): DashboardDailyActivity[] {
  const safeDays = Math.max(1, Math.floor(days));
  const dates = Array.from({ length: safeDays }, (_, index) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - (safeDays - index - 1),
    );

    return {
      date: getLocalDateKey(date),
      label: `${date.getMonth() + 1}.${date.getDate()}`,
    };
  });

  return dates.map(({ date, label }) => {
    const approvedPages = logs
      .filter(
        (log) => log.status === 'approve' && log.readingDate === date,
      )
      .reduce(
        (total, log) => total + getReadingLogTotalPages(log),
        0,
      );
    const submissionCount = logs.filter(
      (log) => getLocalDateKeyFromValue(log.submittedAt) === date,
    ).length;

    return {
      date,
      label,
      approvedPages,
      submissionCount,
    };
  });
}

export function getGenderDistribution(
  participants: ReadonlyArray<DashboardParticipant>,
) {
  return getDistribution(
    participants.map((participant) => {
      const value = participant.gender?.trim();

      return value || '미응답';
    }),
  );
}

export function getAffiliationDistribution(
  participants: ReadonlyArray<DashboardParticipant>,
  visibleLimit = 5,
) {
  const distribution = getDistribution(
    participants.map((participant) => {
      const department = participant.department.trim();

      return department || '미입력';
    }),
  );
  const safeLimit = Math.max(1, Math.floor(visibleLimit));

  if (distribution.length <= safeLimit) {
    return distribution;
  }

  const visibleItems = distribution.slice(0, safeLimit);
  const otherCount = distribution
    .slice(safeLimit)
    .reduce((total, item) => total + item.count, 0);

  return [
    ...visibleItems,
    {
      label: '기타',
      count: otherCount,
      rate: getRate(otherCount, participants.length),
    },
  ];
}

export function getRecentParticipants(
  participants: ReadonlyArray<DashboardParticipant>,
  limit = 5,
) {
  return [...participants]
    .sort((firstParticipant, secondParticipant) => {
      const firstTime = getValidTime(firstParticipant.appliedAt) ?? 0;
      const secondTime = getValidTime(secondParticipant.appliedAt) ?? 0;

      return (
        secondTime - firstTime ||
        firstParticipant.id.localeCompare(secondParticipant.id)
      );
    })
    .slice(0, Math.max(0, Math.floor(limit)));
}

export function getLatestDataTimestamp(
  participants: ReadonlyArray<DashboardParticipant>,
  logs: ReadonlyArray<AdminReadingLog>,
) {
  const timestamps = [
    ...participants.map((participant) => participant.appliedAt),
    ...logs.flatMap((log) => [
      log.submittedAt,
      ...(log.approvedAt ? [log.approvedAt] : []),
    ]),
  ]
    .map(getValidTime)
    .filter((time): time is number => time !== null);

  return timestamps.length > 0
    ? new Date(Math.max(...timestamps)).toISOString()
    : null;
}

export function getDashboardAnalytics(
  participants: ReadonlyArray<DashboardParticipant>,
  logs: ReadonlyArray<AdminReadingLog>,
  now = new Date(),
): DashboardAnalytics {
  const approvedParticipants = getApprovedParticipants(participants);
  const pendingLogs = getPendingReviewLogs(logs);
  const approvedPageTotal = getApprovedPageTotal(logs);

  return {
    totalApplicants: participants.length,
    pendingApplicantCount: participants.filter(
      (participant) => participant.applicationStatus === 'PENDING',
    ).length,
    approvedParticipants,
    todaySubmissionCount: getTodaySubmittedLogs(logs, now).length,
    yesterdaySubmissionCount: getPreviousDaySubmittedLogs(logs, now)
      .length,
    pendingLogs: [...pendingLogs].sort((firstLog, secondLog) => {
      const firstTime = getValidTime(firstLog.submittedAt) ?? 0;
      const secondTime = getValidTime(secondLog.submittedAt) ?? 0;

      return secondTime - firstTime || firstLog.id.localeCompare(secondLog.id);
    }),
    warningPendingCount: pendingLogs.filter(
      (log) => validateReadingLog(log).length > 0,
    ).length,
    approvedPageTotal,
    approvedDistanceMeters: approvedPageTotal * 5,
    genderDistribution: getGenderDistribution(approvedParticipants),
    affiliationDistribution:
      getAffiliationDistribution(approvedParticipants),
    recentParticipants: getRecentParticipants(participants),
    latestDataTimestamp: getLatestDataTimestamp(participants, logs),
  };
}
