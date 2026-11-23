import { apiRequest } from './apiClient';
import type { AdminApplicationAffiliationType } from '../types/adminApplication';

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
