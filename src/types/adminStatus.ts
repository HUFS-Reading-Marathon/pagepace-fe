import type { AdminApplicationAffiliationType, AdminApplicationStatus } from './adminApplication';

export type CourseType = 'short' | 'half' | 'full';

export type StatusActivityFilter = 'ALL' | 'active' | 'inactive';

/** 코스별 완주 집계(서버 API 제공 전 placeholder) */
export type StatusCourseSummary = {
  courseId: CourseType;
  courseName: string;
  participantCount: number;
  completedCount: number;
  averageProgressRate: number;
  totalPages: number;
  totalDistanceMeters: number;
};

export type AdminCompetitionParticipantRow = {
  applicationId: number;
  participationId: number | null;
  userId: number | null;
  name: string;
  studentNumber: string;
  department: string;
  affiliationType: AdminApplicationAffiliationType;
  applicationStatus: AdminApplicationStatus;
  courseId: number;
  courseName: string;
  targetDistanceMeters: number | null;
  cumulativePages: number;
  cumulativeDistanceMeters: number;
  progressRate: number | null;
  dailyIncreasePages: number;
  dailyIncreaseDistanceMeters: number;
  approvedLogCount: number;
  completionStatus: null;
  completedAt: null;
  lastReadingDate: string | null;
  lastProgressAt: string | null;
};

export type AdminCompetitionCourseSummary = {
  courseId: number;
  courseName: string;
  participantCount: number;
  completedCount: null;
  averageProgressRate: number | null;
  totalPages: number;
  totalDistanceMeters: number;
};

export type AdminCompetitionCourseFilter = 'ALL' | number;
export type AdminCompetitionSortOption = 'distance-desc' | 'pages-desc' | 'name-asc';

export const ADMIN_COMPETITION_SORT_OPTIONS: ReadonlyArray<{
  value: AdminCompetitionSortOption;
  label: string;
}> = [
  { value: 'distance-desc', label: '누적 거리 많은 순' },
  { value: 'pages-desc', label: '누적 페이지 많은 순' },
  { value: 'name-asc', label: '이름순' },
];

export const STATUS_ACTIVITY_FILTER_OPTIONS: ReadonlyArray<{
  value: StatusActivityFilter;
  label: string;
}> = [
  { value: 'ALL', label: '전체 독서 여부' },
  { value: 'active', label: '선택 날짜 독서 기록 있음' },
  { value: 'inactive', label: '선택 날짜 독서 기록 없음' },
];
