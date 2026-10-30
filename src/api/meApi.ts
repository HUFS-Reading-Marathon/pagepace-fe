import { apiRequest } from './apiClient';
import type { AuthUser } from '../auth/authTypes';

export type MeUpdateRequest = {
  name: string;
  email: string;
  phone: string;
  affiliationType: string;
  department: string;
};

const ME_PATH = '/api/me';

export function getMe() {
  return apiRequest<AuthUser>(ME_PATH, { method: 'GET' });
}

export function updateMe(request: MeUpdateRequest) {
  return apiRequest<AuthUser>(ME_PATH, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export function changeMyPassword(currentPassword: string, newPassword: string) {
  return apiRequest<null>(`${ME_PATH}/password`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
