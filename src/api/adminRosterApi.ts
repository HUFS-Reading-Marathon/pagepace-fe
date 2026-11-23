import { apiRequest } from './apiClient';
import type {
  AdminApplicationAffiliationType,
  AdminApplicationStatus,
} from '../types/adminApplication';
import type { ParticipationStatus } from '../types/participation';

export type RosterRow = {
  serialNo: number;
  applicationId: number | null;
  participationId: number | null;
  eventId: number;
  courseId: number;
  courseName: string;
  studentNo: string;
  name: string;
  email: string;
  phone: string | null;
  affiliationType: AdminApplicationAffiliationType;
  department: string | null;
  college: string | null;
  grade: string | null;
  gender: string | null;
  applicationStatus: AdminApplicationStatus | null;
  participationStatus: ParticipationStatus | null;
  registeredAt: string;
  rejectReason: string | null;
};

export const ROSTER_STATUSES = {
  APPLIED: '승인 대기',
  APPROVED: '승인',
  COMPLETED: '완주',
  REJECTED: '반려',
  CANCELLED: '참가 취소',
  DISQUALIFIED: '실격',
};

export function rosterKey(row: RosterRow) {
  return row.participationId ? -row.participationId : row.applicationId!;
}

export function rosterStatus(row: RosterRow) {
  return row.participationStatus ?? row.applicationStatus;
}

export async function getRoster(eventId: number) {
  return (
    (await apiRequest<RosterRow[]>(`/api/admin/participations/roster?eventId=${eventId}`)) ?? []
  );
}

export function promoteRoster(eventId: number, participationIds: number[], courseId: number) {
  return apiRequest('/api/admin/participations/course', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, participationIds, courseId }),
  });
}
