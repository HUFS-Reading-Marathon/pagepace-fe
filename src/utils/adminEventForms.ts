import { EVENT_STATUS_LABELS } from '../types/adminEvent';
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

export function getRewardTypeLabel(value: string) {
  return REWARD_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

/** 조회 모드에서 코스 숫자 값을 "10,000"처럼 천 단위 구분자로 표시합니다. */
export function formatCourseNumber(value: string) {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric.toLocaleString('ko-KR') : value;
}

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

/** "2026-11-10" → "2026.11.10" 형태의 짧은 날짜 표기로 변환합니다. */
function formatShortDate(value: string) {
  return value.trim().replaceAll('-', '.');
}

/** 이전 행사 참고용 "2025.11.10 ~ 2025.11.30" 형태의 기간 문자열을 만듭니다. */
export function formatShortDateRange(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    return '';
  }

  return `${formatShortDate(startDate)} ~ ${formatShortDate(endDate)}`;
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

/** 저장 전 변경사항 확인 창에 표시하는 한 줄의 변경 내용입니다. */
export type FormChange = {
  scope: string;
  label: string;
  before: string;
  after: string;
  /** 참가자나 공개 화면에 영향을 주는 변경이면 안내 문구를 함께 보여 줍니다. */
  impact?: string;
};

const EVENT_FIELD_LABELS: Record<keyof EventForm, string> = {
  title: '행사명',
  roundNo: '회차',
  applicationStartDate: '신청 시작일',
  applicationEndDate: '신청 종료일',
  eventStartDate: '독서일지 접수 시작일',
  eventEndDate: '독서일지 접수 종료일',
  status: '운영 상태',
  description: '행사 설명',
  contactPhone: '문의 전화',
  contactEmail: '문의 이메일',
  kakaoOpenChatUrl: '카카오 오픈채팅 URL',
  publicVisible: '사용자 화면 공개',
};

const EVENT_FIELD_IMPACTS: Partial<Record<keyof EventForm, string>> = {
  applicationStartDate: '참가 신청 가능 기간이 바뀝니다.',
  applicationEndDate: '참가 신청 가능 기간이 바뀝니다.',
  eventStartDate: '독서일지 제출 가능 기간이 바뀝니다.',
  eventEndDate: '독서일지 제출 가능 기간이 바뀝니다.',
  status: '사용자 화면의 신청·기록 가능 여부가 바뀔 수 있습니다.',
  publicVisible: '사용자 화면 노출 여부가 바뀝니다.',
};

const COURSE_FIELD_LABELS: Record<keyof CourseForm, string> = {
  name: '코스명',
  targetDistanceMeter: '목표 거리',
  standardBookCount: '기준 도서 수',
  avgMonthlyReadingCount: '월평균 독서량',
  maxWinners: '최대 수상자',
  extraLoanCount: '추가 대출',
  rewardType: '보상 유형',
  rewardAmount: '보상 금액',
  displayOrder: '표시 순서',
};

function formatEventValue(field: keyof EventForm, form: EventForm) {
  const value = form[field];

  if (field === 'publicVisible') {
    return value ? '공개' : '비공개';
  }

  if (field === 'status') {
    return EVENT_STATUS_LABELS[form.status] ?? form.status;
  }

  if (field.endsWith('Date')) {
    return value ? formatShortDate(String(value)) : '미입력';
  }

  return String(value).trim() || '미입력';
}

function formatCourseValue(field: keyof CourseForm, form: CourseForm) {
  if (field === 'rewardType') {
    return getRewardTypeLabel(form.rewardType);
  }

  if (field === 'name') {
    return form.name.trim() || '미입력';
  }

  const formatted = formatCourseNumber(form[field]);

  if (field === 'targetDistanceMeter') return `${formatted}m`;
  if (field === 'rewardAmount') return `${formatted}원`;
  if (field === 'maxWinners') return `${formatted}명`;
  if (field === 'displayOrder') return `${formatted}번째`;
  return `${formatted}권`;
}

/** 저장된 행사 값과 수정 중인 값을 비교해 바뀐 항목만 돌려줍니다. */
export function getEventFormChanges(before: EventForm, after: EventForm): FormChange[] {
  return (Object.keys(EVENT_FIELD_LABELS) as (keyof EventForm)[])
    .filter((field) => String(before[field]).trim() !== String(after[field]).trim())
    .map((field) => ({
      scope: '행사',
      label: EVENT_FIELD_LABELS[field],
      before: formatEventValue(field, before),
      after: formatEventValue(field, after),
      impact: EVENT_FIELD_IMPACTS[field],
    }));
}

/** 서버에서 불러온 코스 값과 수정 중인 코스 값을 코스별로 비교합니다. */
export function getCourseFormChanges(
  before: ReadonlyArray<{ courseId: number; form: CourseForm }>,
  after: ReadonlyArray<{ courseId: number; form: CourseForm }>,
): FormChange[] {
  return after.flatMap(({ courseId, form }) => {
    const saved = before.find((course) => course.courseId === courseId)?.form;

    if (!saved) {
      return [];
    }

    return (Object.keys(COURSE_FIELD_LABELS) as (keyof CourseForm)[])
      .filter((field) => saved[field].trim() !== form[field].trim())
      .map((field) => ({
        scope: saved.name || '코스',
        label: COURSE_FIELD_LABELS[field],
        before: formatCourseValue(field, saved),
        after: formatCourseValue(field, form),
        impact:
          field === 'targetDistanceMeter'
            ? '이 코스 참가자의 달성률과 완주 판정 기준이 바뀝니다.'
            : undefined,
      }));
  });
}
