import { METERS_PER_PAGE } from '../constants/reading';
import { koreaToday } from './eventSelection';

/** 참가신청 화면에서 이메일 아이디 뒤에 고정으로 보여 주는 학교 도메인 */
export const SCHOOL_EMAIL_DOMAIN = 'hufs.ac.kr';

const SCHOOL_EMAIL_SUFFIX = `@${SCHOOL_EMAIL_DOMAIN}`;

/**
 * 이메일 입력값을 화면용 값으로 정리합니다.
 * 학교 주소 전체를 붙여 넣거나 자동완성하면 도메인을 떼어 아이디만 남기고,
 * 다른 도메인 주소는 기존처럼 그대로 사용할 수 있게 둡니다(도메인 제한은 서버 정책을 따릅니다).
 */
export function normalizeEmailIdInput(value: string) {
  const trimmed = value.trim();

  if (trimmed.toLowerCase().endsWith(SCHOOL_EMAIL_SUFFIX)) {
    return trimmed.slice(0, -SCHOOL_EMAIL_SUFFIX.length);
  }

  return value;
}

/** 화면에 입력한 값이 학교 도메인 접미사를 쓰는지 여부 (전체 주소를 직접 입력하면 접미사를 숨깁니다) */
export function usesSchoolEmailSuffix(emailId: string) {
  return !emailId.includes('@');
}

/** 인증·신청 API에 보낼 전체 이메일 주소를 만듭니다. */
export function toApplicationEmail(emailId: string) {
  const trimmed = emailId.trim();

  if (!trimmed) {
    return '';
  }

  return usesSchoolEmailSuffix(trimmed) ? `${trimmed}${SCHOOL_EMAIL_SUFFIX}` : trimmed;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKeyToUtc(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  return year && month && day ? Date.UTC(year, month - 1, day) : Number.NaN;
}

/**
 * 한국 날짜 기준으로 신청 마감일까지 남은 일수를 돌려줍니다.
 * 마감일 당일은 0, 이미 지났거나 날짜를 해석할 수 없으면 null입니다.
 */
export function getApplicationDaysLeft(endDate: string, today = koreaToday()) {
  const days = Math.round((dateKeyToUtc(endDate) - dateKeyToUtc(today)) / DAY_MS);

  return Number.isFinite(days) && days >= 0 ? days : null;
}

/** 코스 목표 거리(m)를 "10km", "21.1km", "42.195km"처럼 표시합니다. */
export function formatCourseDistance(targetDistanceMeter: number) {
  return `${(targetDistanceMeter / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 3 })}km`;
}

/** 코스 목표 거리를 완주에 필요한 쪽수로 바꿉니다. (1쪽 = METERS_PER_PAGE m, 남는 거리는 1쪽으로 올림) */
export function getCourseTargetPages(targetDistanceMeter: number) {
  return Math.ceil(targetDistanceMeter / METERS_PER_PAGE);
}
