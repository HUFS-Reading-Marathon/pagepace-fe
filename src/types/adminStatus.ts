import type { AdminApplicationAffiliationType, AdminApplicationStatus } from './adminApplication';

export type CourseType = 'short' | 'half' | 'full';

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
  completionStatus: 'completed' | 'incomplete';
  completedAt: string | null;
  lastReadingDate: string | null;
  lastProgressAt: string | null;
};

export type AdminCompetitionCourseSummary = {
  courseId: number;
  courseName: string;
  participantCount: number;
  completedCount: number;
  averageProgressRate: number | null;
  totalPages: number;
  totalDistanceMeters: number;
};

export type AdminCompetitionSortOption =
  'distance-desc' | 'distance-asc' | 'pages-desc' | 'pages-asc' | 'name-asc' | 'name-desc';

export const ADMIN_COMPETITION_SORT_OPTIONS: ReadonlyArray<{
  value: AdminCompetitionSortOption;
  label: string;
}> = [
  { value: 'distance-desc', label: '인정 거리 높은 순' },
  { value: 'distance-asc', label: '인정 거리 낮은 순' },
  { value: 'pages-desc', label: '승인 쪽수 많은 순' },
  { value: 'pages-asc', label: '승인 쪽수 적은 순' },
  { value: 'name-asc', label: '이름 가나다순' },
  { value: 'name-desc', label: '이름 역순' },
];
