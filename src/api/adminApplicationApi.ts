import { ApiError, apiRequest } from './apiClient';
import type {
  AdminApplicationDetail,
  AdminApplicationListItem,
} from '../types/adminApplication';

const ADMIN_APPLICATIONS_PATH = '/api/admin/applications';

function validateApplicationId(applicationId: number) {
  if (!Number.isInteger(applicationId) || applicationId <= 0) {
    throw new ApiError(
      '참가신청 ID가 올바르지 않습니다.',
      0,
      'INVALID_APPLICATION_ID',
    );
  }
}

export async function getAdminApplications() {
  const applications = await apiRequest<AdminApplicationListItem[]>(
    ADMIN_APPLICATIONS_PATH,
    { method: 'GET' },
  );

  return applications ?? [];
}

export async function getAdminApplicationDetail(applicationId: number) {
  validateApplicationId(applicationId);

  const application = await apiRequest<AdminApplicationDetail>(
    `${ADMIN_APPLICATIONS_PATH}/${applicationId}`,
    { method: 'GET' },
  );

  if (!application) {
    throw new ApiError(
      '참가신청 상세 응답을 확인할 수 없습니다.',
      200,
      'INVALID_APPLICATION_DETAIL_RESPONSE',
    );
  }

  return application;
}

export async function approveAdminApplication(applicationId: number) {
  validateApplicationId(applicationId);

  return apiRequest<AdminApplicationDetail>(
    `${ADMIN_APPLICATIONS_PATH}/${applicationId}/approve`,
    { method: 'PATCH' },
  );
}
