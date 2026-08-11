import { ApiError, apiRequest } from './apiClient';
import type {
  AdminApplicationDetail,
  AdminApplicationListItem,
} from '../types/adminApplication';

const ADMIN_APPLICATIONS_PATH = '/api/admin/applications';

function validateEventId(eventId: number) {
  if (!Number.isInteger(eventId) || eventId <= 0) {
    throw new ApiError(
      '행사 ID가 올바르지 않습니다.',
      0,
      'INVALID_EVENT_ID',
    );
  }
}

function validateApplicationId(applicationId: number) {
  if (!Number.isInteger(applicationId) || applicationId <= 0) {
    throw new ApiError(
      '참가신청 ID가 올바르지 않습니다.',
      0,
      'INVALID_APPLICATION_ID',
    );
  }
}

export async function getAdminApplications(eventId: number) {
  validateEventId(eventId);
  const searchParams = new URLSearchParams({
    eventId: String(eventId),
  });
  const applications = await apiRequest<AdminApplicationListItem[]>(
    `${ADMIN_APPLICATIONS_PATH}?${searchParams.toString()}`,
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
