import type {
  ReadingLog,
  ReadingLogRequest,
  ParticipantBook,
  ReviewTargetBook,
} from '../types/readingLog';
import { ApiError, apiRequest } from './apiClient';

function validateId(id: number, label: '참가' | '독서일지' | '도서') {
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(
      `${label} ID가 올바르지 않습니다.`,
      0,
      'INVALID_ID',
    );
  }
}

function jsonOptions(body: ReadingLogRequest): RequestInit {
  return {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function getMyReadingLogs(participationId: number) {
  validateId(participationId, '참가');
  const logs = await apiRequest<ReadingLog[]>(
    `/api/participations/${participationId}/reading-logs`,
    { method: 'GET' },
  );
  return logs ?? [];
}

export async function getMyReadingLog(readingLogId: number) {
  validateId(readingLogId, '독서일지');
  const log = await apiRequest<ReadingLog>(`/api/reading-logs/${readingLogId}`, {
    method: 'GET',
  });
  if (!log) {
    throw new ApiError('독서일지를 확인할 수 없습니다.', 200);
  }
  return log;
}

export function createReadingLog(
  participationId: number,
  request: ReadingLogRequest,
) {
  validateId(participationId, '참가');
  return apiRequest<ReadingLog>(
    `/api/participations/${participationId}/reading-logs`,
    { method: 'POST', ...jsonOptions(request) },
  );
}

export function updateReadingLog(
  readingLogId: number,
  request: ReadingLogRequest,
) {
  validateId(readingLogId, '독서일지');
  return apiRequest<ReadingLog>(`/api/reading-logs/${readingLogId}`, {
    method: 'PATCH',
    ...jsonOptions(request),
  });
}

export async function deleteReadingLog(readingLogId: number) {
  validateId(readingLogId, '독서일지');
  await apiRequest<null>(`/api/reading-logs/${readingLogId}`, {
    method: 'DELETE',
  });
}

export async function getReviewTargetBooks() {
  const books = await apiRequest<ReviewTargetBook[]>(
    '/api/me/review-target-books',
    { method: 'GET' },
  );
  return books ?? [];
}

export async function getMyReadingBooks() {
  const books = await apiRequest<ParticipantBook[]>('/api/me/reading-books', {
    method: 'GET',
  });
  return books ?? [];
}

export function completeReview(participantBookId: number) {
  validateId(participantBookId, '도서');
  return apiRequest<ReviewTargetBook>(
    `/api/me/review-target-books/${participantBookId}/complete`,
    { method: 'PATCH' },
  );
}
