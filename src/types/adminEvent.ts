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
  'eventId' | 'createdAt' | 'updatedAt'
>;

export type UpdateEventRequest = CreateEventRequest;

export type AdminCourse = {
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
