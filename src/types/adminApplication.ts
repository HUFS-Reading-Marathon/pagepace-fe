export type AdminApplicationStatus =
  | 'APPLIED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type AdminApplicationAffiliationType =
  | 'UNDERGRADUATE'
  | 'GRADUATE'
  | 'PROFESSOR'
  | 'STAFF'
  | 'OTHER';

export type AdminApplicationListItem = {
  applicationId: number;
  eventId: number;
  eventTitle: string;
  courseId: number;
  courseName: string;
  name: string;
  studentNo: string;
  email: string;
  phone: string;
  affiliationType: AdminApplicationAffiliationType;
  department: string;
  status: AdminApplicationStatus;
  appliedAt: string;
};

export type AdminApplicationDetail = AdminApplicationListItem;

export type ParticipantStatusFilter = 'ALL' | AdminApplicationStatus;
export type ParticipantCourseFilter = 'ALL' | string;
export type ParticipantAffiliationFilter =
  | 'ALL'
  | AdminApplicationAffiliationType;

export const ADMIN_APPLICATION_STATUS_LABELS: Record<
  AdminApplicationStatus,
  string
> = {
  APPLIED: '승인 대기',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELLED: '참가 취소',
};

export const ADMIN_APPLICATION_AFFILIATION_LABELS: Record<
  AdminApplicationAffiliationType,
  string
> = {
  UNDERGRADUATE: '학부생',
  GRADUATE: '대학원생',
  PROFESSOR: '교수',
  STAFF: '직원(연구원 포함)',
  OTHER: '기타',
};

export const ADMIN_APPLICATION_STATUS_OPTIONS = (
  Object.entries(ADMIN_APPLICATION_STATUS_LABELS) as [
    AdminApplicationStatus,
    string,
  ][]
).map(([value, label]) => ({ value, label }));

export const ADMIN_APPLICATION_AFFILIATION_OPTIONS = (
  Object.entries(ADMIN_APPLICATION_AFFILIATION_LABELS) as [
    AdminApplicationAffiliationType,
    string,
  ][]
).map(([value, label]) => ({ value, label }));

export function formatAdminApplicationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatAdminApplicationDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
