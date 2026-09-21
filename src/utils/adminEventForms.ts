import type {
  AdminCourse,
  AdminEvent,
  CreateCourseRequest,
  CreateEventRequest,
  EventStatus,
} from '../types/adminEvent';

/*
 * 행사/코스 설정 페이지의 폼 모델입니다.
 * 서버 DTO(AdminEvent, AdminCourse)와 입력 폼(문자열 필드) 사이의 변환·검증을 담당합니다.
 */

export type EventForm = {
  title: string;
  roundNo: string;
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
};

export type CourseForm = {
  name: string;
  targetDistanceMeter: string;
  standardBookCount: string;
  avgMonthlyReadingCount: string;
  maxWinners: string;
  extraLoanCount: string;
  rewardType: string;
  rewardAmount: string;
  displayOrder: string;
};

export type CourseNumberField = Exclude<keyof CourseForm, 'name' | 'rewardType'>;
export type CoursePresetKey = 'SHORT' | 'HALF' | 'FULL';

export const REWARD_TYPE_OPTIONS = [
  { value: 'GIFT_CARD', label: '문화상품권' },
  { value: 'CASH', label: '상금' },
] as const;

export const EMPTY_EVENT_FORM: EventForm = {
  title: '',
  roundNo: '',
  applicationStartDate: '',
  applicationEndDate: '',
  eventStartDate: '',
  eventEndDate: '',
  status: 'DRAFT',
  description: '',
  contactPhone: '',
  contactEmail: '',
  kakaoOpenChatUrl: '',
  publicVisible: false,
};

export const COURSE_PRESETS: Record<CoursePresetKey, CourseForm> = {
  SHORT: {
    name: '단축 코스',
    targetDistanceMeter: '10000',
    standardBookCount: '7',
    avgMonthlyReadingCount: '2.3',
    maxWinners: '15',
    extraLoanCount: '2',
    rewardType: 'GIFT_CARD',
    rewardAmount: '30000',
    displayOrder: '1',
  },
  HALF: {
    name: '하프 코스',
    targetDistanceMeter: '21100',
    standardBookCount: '14',
    avgMonthlyReadingCount: '4.6',
    maxWinners: '20',
    extraLoanCount: '2',
    rewardType: 'GIFT_CARD',
    rewardAmount: '50000',
    displayOrder: '2',
  },
  FULL: {
    name: '풀 코스',
    targetDistanceMeter: '42195',
    standardBookCount: '28',
    avgMonthlyReadingCount: '9.3',
    maxWinners: '3',
    extraLoanCount: '5',
    rewardType: 'CASH',
    rewardAmount: '150000',
    displayOrder: '3',
  },
};

export const EMPTY_COURSE_FORM: CourseForm = { ...COURSE_PRESETS.SHORT };

export const COURSE_NUMBER_FIELDS: CourseNumberField[] = [
  'targetDistanceMeter',
  'standardBookCount',
  'avgMonthlyReadingCount',
  'maxWinners',
  'extraLoanCount',
  'rewardAmount',
  'displayOrder',
];

export function toEventForm(event: AdminEvent): EventForm {
  return {
    title: event.title,
    roundNo: String(event.roundNo),
    applicationStartDate: event.applicationStartDate,
    applicationEndDate: event.applicationEndDate,
    eventStartDate: event.eventStartDate,
    eventEndDate: event.eventEndDate,
    status: event.status,
    description: event.description ?? '',
    contactPhone: event.contactPhone ?? '',
    contactEmail: event.contactEmail ?? '',
    kakaoOpenChatUrl: event.kakaoOpenChatUrl ?? '',
    publicVisible: event.publicVisible,
  };
}

export function toCourseForm(course: AdminCourse): CourseForm {
  return {
    name: course.name,
    targetDistanceMeter: String(course.targetDistanceMeter),
    standardBookCount: String(course.standardBookCount),
    avgMonthlyReadingCount: String(course.avgMonthlyReadingCount),
    maxWinners: String(course.maxWinners),
    extraLoanCount: String(course.extraLoanCount),
    rewardType: course.rewardType ?? '',
    rewardAmount: String(course.rewardAmount),
    displayOrder: String(course.displayOrder),
  };
}

function getDateUtcValue(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return Date.UTC(year, month - 1, day);
}

function getTodayUtcValue() {
  const today = new Date();

  return Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
}

export function getEventCountdown(startDate: string, endDate: string) {
  const startUtc = getDateUtcValue(startDate);

  if (startUtc === null) {
    return '일정 미설정';
  }

  const todayUtc = getTodayUtcValue();
  const remainingDays = Math.ceil((startUtc - todayUtc) / (24 * 60 * 60 * 1000));

  if (remainingDays > 0) {
    return `D-${remainingDays}`;
  }

  if (remainingDays === 0) {
    return 'D-DAY';
  }

  const endUtc = getDateUtcValue(endDate);

  if (endUtc !== null && todayUtc <= endUtc) {
    return '행사 진행 중';
  }

  return endUtc !== null ? '행사 종료' : '시작일 경과';
}

export function formatDateLabel(value: string) {
  if (!value) {
    return '행사 시작일을 입력해 주세요.';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

export function validateEventForm(form: EventForm) {
  if (!form.title.trim()) {
    return '행사명을 입력해 주세요.';
  }

  const roundNo = Number(form.roundNo);

  if (!Number.isInteger(roundNo) || roundNo <= 0) {
    return '회차는 0보다 큰 정수여야 합니다.';
  }

  if (
    !form.applicationStartDate ||
    !form.applicationEndDate ||
    !form.eventStartDate ||
    !form.eventEndDate
  ) {
    return '행사 기간과 신청 기간의 날짜를 모두 입력해 주세요.';
  }

  if (form.applicationEndDate < form.applicationStartDate) {
    return '신청 종료일은 신청 시작일보다 빠를 수 없습니다.';
  }

  if (form.eventEndDate < form.eventStartDate) {
    return '행사 종료일은 행사 시작일보다 빠를 수 없습니다.';
  }

  return null;
}

export function toEventRequest(form: EventForm): CreateEventRequest {
  return {
    title: form.title.trim(),
    roundNo: Number(form.roundNo),
    applicationStartDate: form.applicationStartDate,
    applicationEndDate: form.applicationEndDate,
    eventStartDate: form.eventStartDate,
    eventEndDate: form.eventEndDate,
    status: form.status,
    description: form.description.trim(),
    contactPhone: form.contactPhone.trim(),
    contactEmail: form.contactEmail.trim(),
    kakaoOpenChatUrl: form.kakaoOpenChatUrl.trim(),
    publicVisible: form.publicVisible,
  };
}

export function validateCourseForm(form: CourseForm) {
  if (!form.name.trim()) {
    return '코스명을 입력해 주세요.';
  }

  for (const field of COURSE_NUMBER_FIELDS) {
    const value = Number(form[field]);

    if (!Number.isFinite(value) || value < 0) {
      return '코스 숫자 항목은 0 이상의 숫자여야 합니다.';
    }
  }

  if (Number(form.targetDistanceMeter) <= 0 || Number(form.standardBookCount) <= 0) {
    return '목표 거리와 기준 도서 수는 0보다 커야 합니다.';
  }

  if (!REWARD_TYPE_OPTIONS.some((option) => option.value === form.rewardType)) {
    return '보상 유형을 선택해 주세요.';
  }

  return null;
}

export function toCourseRequest(form: CourseForm): CreateCourseRequest {
  return {
    name: form.name.trim(),
    targetDistanceMeter: Number(form.targetDistanceMeter),
    standardBookCount: Number(form.standardBookCount),
    avgMonthlyReadingCount: Number(form.avgMonthlyReadingCount),
    maxWinners: Number(form.maxWinners),
    extraLoanCount: Number(form.extraLoanCount),
    rewardType: form.rewardType.trim(),
    rewardAmount: Number(form.rewardAmount),
    displayOrder: Number(form.displayOrder),
  };
}
