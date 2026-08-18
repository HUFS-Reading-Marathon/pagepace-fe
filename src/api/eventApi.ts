import { ApiError, apiRequest } from './apiClient';

export type CurrentEvent = {
  eventId: number;
  title: string;
  roundNo: number;
  applicationStartDate: string;
  applicationEndDate: string;
  eventStartDate: string;
  eventEndDate: string;
  status: string;
  description: string;
  contactPhone: string;
  contactEmail: string;
  kakaoOpenChatUrl: string;
};

export type EventCourse = {
  courseId: number;
  name: string;
  targetDistanceMeter: number;
  standardBookCount: number;
  avgMonthlyReadingCount: number;
  maxWinners: number;
  extraLoanCount: number;
  rewardType: string;
  rewardAmount: number;
  displayOrder: number;
};

export async function getCurrentEvent() {
  const currentEvent = await apiRequest<CurrentEvent>('/api/events/current', {
    method: 'GET',
    skipAuth: true,
  });

  if (!currentEvent) {
    throw new ApiError(
      '현재 신청 가능한 독서마라톤 행사가 없습니다.',
      200,
      'INVALID_CURRENT_EVENT_RESPONSE',
    );
  }

  return currentEvent;
}

export async function getEventCourses(eventId: number) {
  if (!Number.isInteger(eventId) || eventId <= 0) {
    throw new ApiError(
      '행사 정보가 올바르지 않아 코스를 조회할 수 없습니다.',
      0,
      'INVALID_EVENT_ID',
    );
  }

  const courses = await apiRequest<EventCourse[]>(
    `/api/events/${eventId}/courses`,
    {
      method: 'GET',
      skipAuth: true,
    },
  );

  return courses ?? [];
}
