import { apiRequest, ApiError } from './apiClient';
import type { MeUpdateRequest } from './meApi';
export type AdminUser = MeUpdateRequest & {
  userId: number;
  studentNo: string;
  active: boolean;
  status: string;
};
export type AdminParticipation = {
  participationId: number;
  eventId: number;
  courseId: number;
  courseName: string;
  userId: number;
  studentNo: string;
  name: string;
  department: string | null;
  affiliationType: import('../types/adminApplication').AdminApplicationAffiliationType;
  status: string;
  totalPages: number;
  totalDistanceMeter: number;
  completedAt?: string | null;
};
const json = (body: object) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
export async function getAdminUsers() {
  return (await apiRequest<AdminUser[]>('/api/admin/users')) ?? [];
}
export async function createAdminUser(
  body: MeUpdateRequest & { studentNo: string; password: string },
) {
  const user = await apiRequest<AdminUser>('/api/admin/users', json({ ...body, role: 'USER' }));
  if (!user) throw new ApiError('사용자 생성 응답이 없습니다.');
  return user;
}
export async function getAdminParticipations(eventId: number) {
  return (
    (await apiRequest<AdminParticipation[]>(`/api/admin/participations?eventId=${eventId}`)) ?? []
  );
}
export async function registerParticipant(eventId: number, courseId: number, userId: number) {
  return apiRequest<AdminParticipation>(
    '/api/admin/participations',
    json({ eventId, courseId, userId }),
  );
}
