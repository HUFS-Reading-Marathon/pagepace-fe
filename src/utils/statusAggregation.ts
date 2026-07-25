import {
  COURSE_LABELS,
  type AdminParticipant,
  type CourseType,
} from '../types/adminParticipant';
import {
  getReadingLogTotalPages,
  type AdminReadingLog,
} from '../types/adminReadingLog';
import type {
  ParticipantStatusRow,
  StatusCourseSummary,
  StatusSnapshot,
  StatusVisibilitySettings,
} from '../types/adminStatus';
import type { EventSettings } from '../types/adminEventSettings';

const METERS_PER_PAGE = 5;

export const STATUS_COURSE_ORDER: CourseType[] = [
  'short',
  'half',
  'full',
];

function compareProgressRows(
  firstRow: ParticipantStatusRow,
  secondRow: ParticipantStatusRow,
) {
  if (firstRow.cumulativePages !== secondRow.cumulativePages) {
    return secondRow.cumulativePages - firstRow.cumulativePages;
  }

  const firstReachedAt = firstRow.lastProgressAt ?? '';
  const secondReachedAt = secondRow.lastProgressAt ?? '';

  if (firstReachedAt !== secondReachedAt) {
    return firstReachedAt.localeCompare(secondReachedAt);
  }

  return firstRow.participantId.localeCompare(secondRow.participantId);
}

function getCompletionDate(
  logs: AdminReadingLog[],
  targetPages: number,
) {
  let accumulatedPages = 0;
  const sortedLogs = [...logs].sort((firstLog, secondLog) => {
    if (firstLog.readingDate !== secondLog.readingDate) {
      return firstLog.readingDate.localeCompare(secondLog.readingDate);
    }

    const firstProgressAt = firstLog.approvedAt ?? firstLog.submittedAt;
    const secondProgressAt = secondLog.approvedAt ?? secondLog.submittedAt;

    return firstProgressAt.localeCompare(secondProgressAt);
  });

  for (const log of sortedLogs) {
    accumulatedPages += getReadingLogTotalPages(log);

    if (accumulatedPages >= targetPages) {
      return log.readingDate;
    }
  }

  return undefined;
}

function getLastProgressAt(logs: AdminReadingLog[]) {
  return logs.reduce<string | undefined>((latestValue, log) => {
    const progressAt = log.approvedAt ?? log.submittedAt;

    return !latestValue || progressAt > latestValue
      ? progressAt
      : latestValue;
  }, undefined);
}

function assignRankings(rows: ParticipantStatusRow[]) {
  const overallRankByParticipant = new Map(
    [...rows]
      .sort(compareProgressRows)
      .map((row, index) => [row.participantId, index + 1]),
  );
  const courseRankByParticipant = new Map<string, number>();

  STATUS_COURSE_ORDER.forEach((courseId) => {
    [...rows]
      .filter((row) => row.courseId === courseId)
      .sort(compareProgressRows)
      .forEach((row, index) => {
        courseRankByParticipant.set(row.participantId, index + 1);
      });
  });

  return rows.map((row) => ({
    ...row,
    courseRank: courseRankByParticipant.get(row.participantId) ?? 0,
    overallRank: overallRankByParticipant.get(row.participantId) ?? 0,
  }));
}

export function buildStatusSnapshot(
  participants: AdminParticipant[],
  logs: AdminReadingLog[],
  baseDate: string,
  courseStandards: EventSettings['courseStandards'],
  settings: StatusVisibilitySettings,
  generatedAt = new Date().toISOString(),
): StatusSnapshot {
  const approvedParticipants = participants.filter(
    (participant) => participant.applicationStatus === 'APPROVED',
  );
  const approvedLogs = logs.filter(
    (log) => log.status === 'approve' && log.readingDate <= baseDate,
  );
  const baseRows = approvedParticipants.map<ParticipantStatusRow>(
    (participant) => {
      const participantLogs = approvedLogs.filter(
        (log) => log.participantId === participant.id,
      );
      const cumulativePages = participantLogs.reduce(
        (sum, log) => sum + getReadingLogTotalPages(log),
        0,
      );
      const dailyIncreasePages = participantLogs
        .filter((log) => log.readingDate === baseDate)
        .reduce(
          (sum, log) => sum + getReadingLogTotalPages(log),
          0,
        );
      const targetPages = courseStandards[participant.course];
      const completedAt = getCompletionDate(
        participantLogs,
        targetPages,
      );

      return {
        participantId: participant.id,
        name: participant.name,
        studentNumber: participant.loginId,
        courseId: participant.course,
        courseName: COURSE_LABELS[participant.course],
        targetPages,
        targetDistanceMeters: targetPages * METERS_PER_PAGE,
        cumulativePages,
        cumulativeDistanceMeters: cumulativePages * METERS_PER_PAGE,
        progressRate:
          targetPages > 0
            ? Math.min((cumulativePages / targetPages) * 100, 100)
            : 0,
        dailyIncreasePages,
        dailyIncreaseDistanceMeters:
          dailyIncreasePages * METERS_PER_PAGE,
        isCompleted: completedAt !== undefined,
        completedAt,
        lastProgressAt: getLastProgressAt(participantLogs),
        courseRank: 0,
        overallRank: 0,
      };
    },
  );
  const rankedRows = assignRankings(baseRows).sort((firstRow, secondRow) => {
    const courseOrderDifference =
      STATUS_COURSE_ORDER.indexOf(firstRow.courseId) -
      STATUS_COURSE_ORDER.indexOf(secondRow.courseId);

    return courseOrderDifference || firstRow.courseRank - secondRow.courseRank;
  });

  return {
    id: `status-draft-${baseDate}-${generatedAt}`,
    baseDate,
    generatedAt,
    settings: { ...settings },
    participants: rankedRows,
  };
}

export function cloneStatusSnapshot(
  snapshot: StatusSnapshot,
  id: string,
  generatedAt: string,
): StatusSnapshot {
  return {
    id,
    baseDate: snapshot.baseDate,
    generatedAt,
    settings: { ...snapshot.settings },
    participants: snapshot.participants.map((participant) => ({
      ...participant,
    })),
  };
}

function getComparableSnapshot(snapshot: StatusSnapshot) {
  return {
    baseDate: snapshot.baseDate,
    settings: snapshot.settings,
    participants: [...snapshot.participants]
      .sort((firstRow, secondRow) =>
        firstRow.participantId.localeCompare(secondRow.participantId),
      )
      .map((participant) => ({ ...participant })),
  };
}

export function hasUnpublishedChanges(
  draftSnapshot: StatusSnapshot,
  publishedSnapshot: StatusSnapshot | null,
) {
  if (!publishedSnapshot) {
    return true;
  }

  return (
    JSON.stringify(getComparableSnapshot(draftSnapshot)) !==
    JSON.stringify(getComparableSnapshot(publishedSnapshot))
  );
}

export function getStatusCourseSummaries(
  rows: ParticipantStatusRow[],
): StatusCourseSummary[] {
  return STATUS_COURSE_ORDER.map((courseId) => {
    const courseRows = rows.filter((row) => row.courseId === courseId);
    const progressTotal = courseRows.reduce(
      (sum, row) => sum + row.progressRate,
      0,
    );
    const totalPages = courseRows.reduce(
      (sum, row) => sum + row.cumulativePages,
      0,
    );

    return {
      courseId,
      courseName: COURSE_LABELS[courseId],
      participantCount: courseRows.length,
      completedCount: courseRows.filter((row) => row.isCompleted).length,
      averageProgressRate:
        courseRows.length > 0 ? progressTotal / courseRows.length : 0,
      totalPages,
      totalDistanceMeters: totalPages * METERS_PER_PAGE,
    };
  });
}

export function maskParticipantName(name: string) {
  const characters = Array.from(name.trim());

  if (characters.length === 0) {
    return '—';
  }

  if (characters.length === 1) {
    return '*';
  }

  if (characters.length === 2) {
    return `${characters[0]}*`;
  }

  return `${characters[0]}${'*'.repeat(characters.length - 2)}${
    characters[characters.length - 1]
  }`;
}

export function formatStatusDistance(meters: number) {
  return meters >= 1000
    ? `${(meters / 1000).toLocaleString('ko-KR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      })}km`
    : `${meters.toLocaleString('ko-KR')}m`;
}

export function formatStatusDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(`${value}T00:00:00`));
}

export function formatStatusDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

