import type {
  AdminCourse,
  AdminEvent,
  CreateCourseRequest,
  CreateEventRequest,
  UpdateCourseRequest,
  UpdateEventRequest,
} from '../types/adminEvent';
import { ApiError, apiRequest } from './apiClient';

const ADMIN_EVENTS_PATH = '/api/admin/events';
const ADMIN_COURSES_PATH = '/api/admin/courses';

function validateId(id: number, label: '행사' | '코스') {
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(
      `${label} ID가 올바르지 않습니다.`,
      0,
      `INVALID_${label === '행사' ? 'EVENT' : 'COURSE'}_ID`,
    );
  }
}

function jsonOptions(method: 'POST' | 'PATCH', body: object): RequestInit {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

export async function getAdminEvents() {
  const events = await apiRequest<AdminEvent[]>(ADMIN_EVENTS_PATH, {
    method: 'GET',
  });

  return events ?? [];
}

export async function getAdminEvent(eventId: number) {
  validateId(eventId, '행사');

  const event = await apiRequest<AdminEvent>(
    `${ADMIN_EVENTS_PATH}/${eventId}`,
    { method: 'GET' },
  );

  if (!event) {
    throw new ApiError(
      '행사 상세 응답을 확인할 수 없습니다.',
      200,
      'INVALID_ADMIN_EVENT_RESPONSE',
    );
  }

  return event;
}

export async function createAdminEvent(request: CreateEventRequest) {
  return apiRequest<AdminEvent>(
    ADMIN_EVENTS_PATH,
    jsonOptions('POST', request),
  );
}

export async function updateAdminEvent(
  eventId: number,
  request: UpdateEventRequest,
) {
  validateId(eventId, '행사');

  return apiRequest<AdminEvent>(
    `${ADMIN_EVENTS_PATH}/${eventId}`,
    jsonOptions('PATCH', request),
  );
}

export async function deleteAdminEvent(eventId: number) {
  validateId(eventId, '행사');

  await apiRequest<null>(`${ADMIN_EVENTS_PATH}/${eventId}`, {
    method: 'DELETE',
  });
}

export async function getAdminEventCourses(eventId: number) {
  validateId(eventId, '행사');

  const courses = await apiRequest<AdminCourse[]>(
    `${ADMIN_EVENTS_PATH}/${eventId}/courses`,
    { method: 'GET' },
  );

  return (courses ?? []).sort(
    (left, right) => left.displayOrder - right.displayOrder,
  );
}

export async function createAdminCourse(
  eventId: number,
  request: CreateCourseRequest,
) {
  validateId(eventId, '행사');

  return apiRequest<AdminCourse>(
    `${ADMIN_EVENTS_PATH}/${eventId}/courses`,
    jsonOptions('POST', request),
  );
}

export async function updateAdminCourse(
  courseId: number,
  request: UpdateCourseRequest,
) {
  validateId(courseId, '코스');

  return apiRequest<AdminCourse>(
    `${ADMIN_COURSES_PATH}/${courseId}`,
    jsonOptions('PATCH', request),
  );
}

export async function deleteAdminCourse(courseId: number) {
  validateId(courseId, '코스');

  await apiRequest<null>(`${ADMIN_COURSES_PATH}/${courseId}`, {
    method: 'DELETE',
  });
}
