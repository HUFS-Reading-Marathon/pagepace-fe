import { apiRequest, ApiError } from './apiClient';
import type {
  AdminApplicationAffiliationType,
  AdminApplicationStatus,
} from '../types/adminApplication';

import type { ParticipationStatus } from '../types/participation';

type ReportFields = { college?: string; grade?: string; gender?: string };

export type ParticipantProfile = {
  name: string;
  email: string;
  phone: string;
  affiliationType: AdminApplicationAffiliationType;
  department: string;
};

type NewUser = ParticipantProfile & { studentNo: string; initialPassword: string };
type Enrollment = { eventId: number; courseId: number } & ReportFields &
  ({ newUser: NewUser } | { userId: number });

type LookupUser = {
  userId: number;
  studentNo: string;
  name: string;
  email: string | null;
  phone: string | null;
  affiliationType: AdminApplicationAffiliationType;
  department: string | null;
  college: string | null;
  grade: string | null;
  gender: string | null;
};
export type RegistrationLookup = {
  studentNo: string;
  applicationStatus: AdminApplicationStatus | null;
  participationStatus: ParticipationStatus | null;
} & (
  | { state: 'EXISTING'; user: LookupUser }
  | { state: 'NEW'; user: null }
  | { state: 'ALREADY_REGISTERED' | 'INACTIVE'; user: LookupUser | null }
);

export async function lookupRosterAccount(eventId: number, studentNo: string, signal: AbortSignal) {
  const params = new URLSearchParams({ eventId: String(eventId), studentNo });
  const result = await apiRequest<RegistrationLookup>(
    '/api/admin/participations/registration-lookup?' + params,
    { signal, cache: 'no-store' },
  );
  if (!result) throw new ApiError('회원 조회 결과를 확인할 수 없습니다.');
  return result;
}

export function addRosterParticipant(input: Enrollment) {
  return apiRequest('/api/admin/participations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateRosterParticipant(
  resource: 'participations' | 'applications',
  id: number,
  input: ParticipantProfile & ReportFields & { courseId: number },
) {
  return apiRequest(`/api/admin/${resource}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
