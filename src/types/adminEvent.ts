export const EVENT_STATUSES = [
  'DRAFT',
  'READY',
  'APPLICATION_OPEN',
  'APPLICATION_CLOSED',
  'IN_PROGRESS',
  'ENDED',
  'FINALIZED',
  'ARCHIVED',
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: '작성 중',
  READY: '준비',
  APPLICATION_OPEN: '신청 접수 중',
  APPLICATION_CLOSED: '신청 마감',
  IN_PROGRESS: '진행 중',
  ENDED: '종료',
  FINALIZED: '최종 확정',
  ARCHIVED: '보관',
};

/**
 * 서버가 일정에 따라 자동으로 정하는 상태가 아닌, 관리자가 직접 다루는 상태(작성 중·최종 확정·보관).
 * 나머지 상태는 한국 시간 기준 행사 기간에 따라 서버가 자동으로 정합니다.
 */
const MANUAL_EVENT_STATUSES: readonly EventStatus[] = ['DRAFT', 'FINALIZED', 'ARCHIVED'];

export function isManualEventStatus(status: EventStatus) {
  return MANUAL_EVENT_STATUSES.includes(status);
}

/** 서버 행사 상태 값을 화면 표시용 라벨로 바꿉니다. 알 수 없는 값이면 undefined를 돌려줍니다. */
export function getEventStatusLabel(status: string | null | undefined) {
  return status && status in EVENT_STATUS_LABELS
    ? EVENT_STATUS_LABELS[status as EventStatus]
    : undefined;
}

export type AdminEvent = {
  eventId: number;
  title: string;
  roundNo: number;
  applicationStartDate: string;
  applicationEndDate: string;
  eventStartDate: string;
  eventEndDate: string;
  status: EventStatus;
  description: string;
  contactPhone: string;
  contactEmail: string;
  kakaoOpenChatUrl: string;
  publicVisible: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateEventRequest = Omit<
  AdminEvent,
  'eventId' | 'createdAt' | 'updatedAt' | 'status'
> & {
  /** 서버가 기간으로 정하므로 보통 보내지 않습니다. 최종 확정·보관 요청일 때만 보냅니다. */
  status?: EventStatus;
};

export type UpdateEventRequest = CreateEventRequest & { confirmStructuralChange?: boolean };

export type AdminCourse = {
  active?: boolean;
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

export type CreateCourseRequest = Omit<AdminCourse, 'courseId'>;

export type UpdateCourseRequest = CreateCourseRequest;
