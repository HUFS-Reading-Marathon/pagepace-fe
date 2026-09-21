import type { AffiliationType } from '../auth/authTypes';

export type AdminApplicationStatus =
  | 'APPLIED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

/** 서버 AffiliationType enum과 동일한 값입니다. */
export type AdminApplicationAffiliationType = AffiliationType;

export type AdminApplicationListItem = {
  applicationId: number;
  eventId: number;
  eventTitle: string;
  courseId: number;
  courseName: string;
  name: string;
  studentNo: string;
  email: string;
  phone: string | null;
  affiliationType: AdminApplicationAffiliationType;
  department: string | null;
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
