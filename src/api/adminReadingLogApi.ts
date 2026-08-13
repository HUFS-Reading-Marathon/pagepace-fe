import type {
  AdminReadingLogListParams,
  AdminReadingLogResponse,
  RejectAdminReadingLogRequest,
} from '../types/adminReadingLogApi';
import { ApiError, apiRequest } from './apiClient';

const ADMIN_READING_LOGS_PATH = '/api/admin/reading-logs';

function validateId(id: number, label: '행사' | '독서일지') {
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(
      `${label} ID가 올바르지 않습니다.`,
      0,
      `INVALID_${label === '행사' ? 'EVENT' : 'READING_LOG'}_ID`,
    );
  }
}

export async function getAdminReadingLogs({
  eventId,
  status,
}: AdminReadingLogListParams) {
  validateId(eventId, '행사');

  const searchParams = new URLSearchParams({
    eventId: String(eventId),
  });

  if (status) {
    searchParams.set('status', status);
  }

  const logs = await apiRequest<AdminReadingLogResponse[]>(
    `${ADMIN_READING_LOGS_PATH}?${searchParams.toString()}`,
    { method: 'GET' },
  );

  return logs ?? [];
}

export async function getAdminReadingLogDetail(readingLogId: number) {
  validateId(readingLogId, '독서일지');

  const log = await apiRequest<AdminReadingLogResponse>(
    `${ADMIN_READING_LOGS_PATH}/${readingLogId}`,
    { method: 'GET' },
  );

  if (!log) {
    throw new ApiError(
      '독서일지 상세 응답을 확인할 수 없습니다.',
      200,
      'INVALID_ADMIN_READING_LOG_RESPONSE',
    );
  }

  return log;
}

export async function approveAdminReadingLog(readingLogId: number) {
  validateId(readingLogId, '독서일지');

  return apiRequest<AdminReadingLogResponse>(
    `${ADMIN_READING_LOGS_PATH}/${readingLogId}/approve`,
    { method: 'PATCH' },
  );
}

export async function rejectAdminReadingLog(
  readingLogId: number,
  request: RejectAdminReadingLogRequest,
) {
  validateId(readingLogId, '독서일지');

  const reason = request.reason.trim();

  if (!reason) {
    throw new ApiError(
      '반려 사유를 입력해 주세요.',
      0,
      'INVALID_REJECTION_REASON',
    );
  }

  return apiRequest<AdminReadingLogResponse>(
    `${ADMIN_READING_LOGS_PATH}/${readingLogId}/reject`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    },
  );
}
