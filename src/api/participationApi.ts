import type { MyParticipation } from '../types/participation';
import { ApiError, apiRequest } from './apiClient';

export async function getMyParticipations() {
  const participations = await apiRequest<MyParticipation[]>('/api/me/participations', {
    method: 'GET',
  });

  return participations ?? [];
}

export async function getCurrentParticipation() {
  const participation = await apiRequest<MyParticipation>('/api/me/participations/current', {
    method: 'GET',
  });

  if (!participation) {
    throw new ApiError(
      '현재 참가 정보를 확인할 수 없습니다.',
      200,
      'INVALID_CURRENT_PARTICIPATION_RESPONSE',
    );
  }

  return participation;
}
