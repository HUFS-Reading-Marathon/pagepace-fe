export type CourseType = 'short' | 'half' | 'full';

export type AffiliationType =
  | 'undergraduate'
  | 'graduate'
  | 'professor'
  | 'lecturer'
  | 'staff';

export type GradeType = '1' | '2' | '3' | '4';

export type ParticipantApplicationStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type ParticipantDialogMode =
  | 'view'
  | 'edit'
  | 'reject'
  | 'course'
  | 'cancel';

export type ParticipantStatusFilter =
  | 'ALL'
  | ParticipantApplicationStatus;

export type ParticipantCourseFilter = 'ALL' | CourseType;

export type ParticipantAffiliationFilter = 'ALL' | AffiliationType;

export type AdminParticipant = {
  id: string;
  name: string;
  loginId: string;
  department: string;
  affiliation: AffiliationType;
  grade: GradeType | null;
  phone: string;
  email: string;
  course: CourseType;
  applicationStatus: ParticipantApplicationStatus;
  appliedAt: string;
  privacyAgreed: boolean;
  rejectionReason?: string;
  adminMemo?: string;
};

export type AdminParticipantUpdate = Partial<
  Pick<
    AdminParticipant,
    | 'name'
    | 'loginId'
    | 'department'
    | 'affiliation'
    | 'grade'
    | 'phone'
    | 'email'
    | 'course'
    | 'adminMemo'
  >
>;

export const COURSE_OPTIONS: {
  label: string;
  value: CourseType;
}[] = [
  { label: '단축코스', value: 'short' },
  { label: '하프코스', value: 'half' },
  { label: '풀코스', value: 'full' },
];

export const AFFILIATION_OPTIONS: {
  label: string;
  value: AffiliationType;
}[] = [
  { label: '학부생', value: 'undergraduate' },
  { label: '대학원생', value: 'graduate' },
  { label: '교수', value: 'professor' },
  { label: '강사', value: 'lecturer' },
  { label: '직원(연구원 포함)', value: 'staff' },
];

export const PARTICIPANT_STATUS_LABELS: Record<
  ParticipantApplicationStatus,
  string
> = {
  PENDING: '승인 대기',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELLED: '참가 취소',
};

export const PARTICIPANT_STATUS_OPTIONS: {
  label: string;
  value: ParticipantApplicationStatus;
}[] = (
  Object.entries(PARTICIPANT_STATUS_LABELS) as [
    ParticipantApplicationStatus,
    string,
  ][]
).map(([value, label]) => ({ label, value }));

export const COURSE_LABELS = Object.fromEntries(
  COURSE_OPTIONS.map(({ label, value }) => [value, label]),
) as Record<CourseType, string>;

export const AFFILIATION_LABELS = Object.fromEntries(
  AFFILIATION_OPTIONS.map(({ label, value }) => [value, label]),
) as Record<AffiliationType, string>;

export function getAffiliationDisplay(
  affiliation: AffiliationType,
  grade: GradeType | null,
) {
  const label = AFFILIATION_LABELS[affiliation];

  return affiliation === 'undergraduate' && grade
    ? `${label} · ${grade}학년`
    : label;
}

export function formatParticipantDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

export function formatParticipantDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
