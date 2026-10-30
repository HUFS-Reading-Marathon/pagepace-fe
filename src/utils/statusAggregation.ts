import type { AdminParticipation } from '../api/adminParticipationApi';
import type { AdminCourse } from '../types/adminEvent';
import type { AdminReadingLogResponse } from '../types/adminReadingLogApi';
import type {
  AdminCompetitionCourseSummary,
  AdminCompetitionParticipantRow,
} from '../types/adminStatus';

export function formatStatusDistance(meters: number) {
  return meters >= 1000
    ? `${(meters / 1000).toLocaleString('ko-KR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      })}km`
    : `${meters.toLocaleString('ko-KR')}m`;
}

export function buildAdminCompetitionRows(
  participants: ReadonlyArray<AdminParticipation>,
  logs: ReadonlyArray<AdminReadingLogResponse>,
  courses: ReadonlyArray<AdminCourse>,
  baseDate: string,
): AdminCompetitionParticipantRow[] {
  return participants
    .filter((p) => p.status === 'APPROVED' || p.status === 'COMPLETED')
    .map((p) => {
      const participantLogs = logs.filter(
        (log) => log.participationId === p.participationId && log.status === 'APPROVED',
      );
      const dailyLogs = participantLogs.filter((log) => log.readingDate === baseDate);
      const latest = [...participantLogs].sort((a, b) =>
        b.readingDate.localeCompare(a.readingDate),
      )[0];
      const target =
        courses.find((course) => course.courseId === p.courseId)?.targetDistanceMeter ?? null;
      return {
        applicationId: p.participationId,
        participationId: p.participationId,
        userId: p.userId,
        name: p.name,
        studentNumber: p.studentNo,
        department: p.department || '미입력',
        affiliationType: p.affiliationType,
        applicationStatus: 'APPROVED',
        courseId: p.courseId,
        courseName: p.courseName,
        targetDistanceMeters: target,
        cumulativePages: p.totalPages,
        cumulativeDistanceMeters: p.totalDistanceMeter,
        progressRate: target ? Math.min((p.totalDistanceMeter / target) * 100, 100) : null,
        dailyIncreasePages: dailyLogs.reduce((sum, log) => sum + log.totalReadPages, 0),
        dailyIncreaseDistanceMeters: dailyLogs.reduce(
          (sum, log) => sum + log.totalReadPages * 5,
          0,
        ),
        approvedLogCount: participantLogs.length,
        completionStatus: p.status === 'COMPLETED' ? 'completed' : 'incomplete',
        completedAt: p.completedAt ?? null,
        lastReadingDate: latest?.readingDate ?? null,
        lastProgressAt: latest?.reviewedAt ?? null,
      };
    });
}

export function getAdminCompetitionCourseSummaries(
  rows: ReadonlyArray<AdminCompetitionParticipantRow>,
  courses: ReadonlyArray<AdminCourse>,
): AdminCompetitionCourseSummary[] {
  return courses.map((course) => {
    const courseRows = rows.filter((row) => row.courseId === course.courseId);
    const progressValues = courseRows
      .map((row) => row.progressRate)
      .filter((value): value is number => value !== null);

    return {
      courseId: course.courseId,
      courseName: course.name,
      participantCount: courseRows.length,
      completedCount: courseRows.filter((row) => row.completionStatus === 'completed').length,
      averageProgressRate:
        progressValues.length > 0
          ? progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length
          : null,
      totalPages: courseRows.reduce((sum, row) => sum + row.cumulativePages, 0),
      totalDistanceMeters: courseRows.reduce((sum, row) => sum + row.cumulativeDistanceMeters, 0),
    };
  });
}
