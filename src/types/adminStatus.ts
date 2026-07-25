import type { CourseType } from './adminParticipant';

export type StatusVisibilitySettings = {
  maskNames: boolean;
  showRanks: boolean;
};

export type ParticipantStatusRow = {
  participantId: string;
  name: string;
  studentNumber: string;
  courseId: CourseType;
  courseName: string;
  targetPages: number;
  targetDistanceMeters: number;
  cumulativePages: number;
  cumulativeDistanceMeters: number;
  progressRate: number;
  dailyIncreasePages: number;
  dailyIncreaseDistanceMeters: number;
  isCompleted: boolean;
  completedAt?: string;
  lastProgressAt?: string;
  courseRank: number;
  overallRank: number;
};

export type StatusSnapshot = {
  id: string;
  baseDate: string;
  generatedAt: string;
  settings: StatusVisibilitySettings;
  participants: ParticipantStatusRow[];
};

export type StatusCourseSummary = {
  courseId: CourseType;
  courseName: string;
  participantCount: number;
  completedCount: number;
  averageProgressRate: number;
  totalPages: number;
  totalDistanceMeters: number;
};

export type StatusCourseFilter = 'ALL' | CourseType;
export type StatusCompletionFilter = 'ALL' | 'completed' | 'incomplete';
export type StatusActivityFilter = 'ALL' | 'active' | 'inactive';
export type StatusSortOption =
  | 'course-rank'
  | 'overall-rank'
  | 'pages-desc'
  | 'name-asc';
export type StatusDialogMode = 'publish' | 'unpublish' | null;

export const STATUS_COURSE_FILTER_OPTIONS: ReadonlyArray<{
  value: StatusCourseFilter;
  label: string;
}> = [
  { value: 'ALL', label: '전체 코스' },
  { value: 'short', label: '단축코스' },
  { value: 'half', label: '하프코스' },
  { value: 'full', label: '풀코스' },
];

export const STATUS_COMPLETION_FILTER_OPTIONS: ReadonlyArray<{
  value: StatusCompletionFilter;
  label: string;
}> = [
  { value: 'ALL', label: '전체 완주 상태' },
  { value: 'completed', label: '완주' },
  { value: 'incomplete', label: '미완주' },
];

export const STATUS_ACTIVITY_FILTER_OPTIONS: ReadonlyArray<{
  value: StatusActivityFilter;
  label: string;
}> = [
  { value: 'ALL', label: '전체 독서 여부' },
  { value: 'active', label: '선택 날짜 독서 기록 있음' },
  { value: 'inactive', label: '선택 날짜 독서 기록 없음' },
];

export const STATUS_SORT_OPTIONS: ReadonlyArray<{
  value: StatusSortOption;
  label: string;
}> = [
  { value: 'course-rank', label: '코스별 공식 순위' },
  { value: 'overall-rank', label: '전체 참고 순위' },
  { value: 'pages-desc', label: '누적 페이지 많은 순' },
  { value: 'name-asc', label: '이름순' },
];

