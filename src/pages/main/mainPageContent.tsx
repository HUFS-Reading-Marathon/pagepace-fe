import type { ReactNode } from 'react';
import type { EventCourse } from '../../api/eventApi';
import { METERS_PER_PAGE } from '../../constants/reading';

/*
 * 메인 페이지에서 사용하는 정적 콘텐츠와 서버 조회 실패 시 사용하는 fallback 값입니다.
 * - FALLBACK_*: API 응답이 없을 때 화면에 그대로 표시되는 값 (동작에 영향)
 * - 그 외: 화면 표시용 고정 문구
 */

export type QuickLink = {
  eyebrow: string;
  title: string;
  href: string;
  external?: boolean;
};

export type CourseRow = {
  name: string;
  distance: string;
  pages: string;
  books: string;
  monthly: string;
  reward: ReactNode;
  loan: string;
  people: string;
};

export type ProcessStep = {
  no: number;
  title: string;
  desc: string;
};

/** 서버 공지사항이 없을 때 표시하는 안내 항목 */
export type FallbackNotice = {
  badge: string;
  title: string;
  href: string;
  date: string;
  dateTime: string;
};

export type MyRecordSummary = {
  course: string;
  targetDistance: number;
  totalDistance: number;
  totalPages: number;
  approvedLogs: number;
  lastSubmittedAt: string;
};

export const APPLY_FORM_URL = 'https://forms.gle/QxsWgxTH7AmRUbfB9';

export const FALLBACK_EVENT_TITLE = '제5회 독서마라톤';

export const FALLBACK_HERO_INFO: [string, string][] = [
  ['운영기간', '2025. 12. 8.(월) — 2026. 2. 1.(일)'],
  ['신청기간', '2025. 11. 24.(월) — 12. 7.(일)'],
  ['참가대상', '글로벌캠퍼스 학부 재학생(휴학생 제외)'],
];

export const QUICK_LINKS: QuickLink[] = [
  { eyebrow: 'Step 1', title: '코스 선택하기', href: '#courses' },
  { eyebrow: 'Step 2', title: '참여방법 확인', href: '#process' },
  {
    eyebrow: 'Step 3',
    title: '참가신청 작성',
    href: APPLY_FORM_URL,
    external: true,
  },
  { eyebrow: 'Status', title: '대회 현황 보기', href: '/status' },
];

export const SUMMARY_ITEMS: [string, string][] = [
  ['환산기준', '책 1쪽을 5m로 환산'],
  ['기록방법', '독서일지에 도서 정보와 읽은 페이지 수 입력'],
  ['서평작성', '도서관 홈페이지 로그인 후 해당 도서 상세페이지에서 작성'],
  ['결과확인', '누적 거리와 코스별 완주 여부를 대회 현황에서 확인'],
];

export const FALLBACK_COURSES: CourseRow[] = [
  {
    name: '단축코스',
    distance: '10,000m',
    pages: '2,000쪽',
    books: '7권',
    monthly: '2.3권',
    reward: '문화상품권 3만원권',
    loan: '2권',
    people: '15명',
  },
  {
    name: '하프코스',
    distance: '21,100m',
    pages: '4,220쪽',
    books: '14권',
    monthly: '4.6권',
    reward: '문화상품권 5만원권',
    loan: '2권',
    people: '20명',
  },
  {
    name: '풀코스',
    distance: '42,195m',
    pages: '8,439쪽',
    books: '28권',
    monthly: '9.3권',
    reward: (
      <>
        상금 150,000원
        <br />
        <small>기타소득세 22% 공제 후 지급</small>
      </>
    ),
    loan: '5권',
    people: '3명',
  },
];

export const PROCESS_STEPS: ProcessStep[] = [
  {
    no: 1,
    title: '참가 신청',
    desc: '참가신청서를 작성하고 신청 정보를 제출합니다. 제출 후 승인 안내를 확인해 주세요.',
  },
  {
    no: 2,
    title: '코스 선택',
    desc: '단축·하프·풀코스 중 목표 독서량에 맞는 코스를 선택합니다.',
  },
  {
    no: 3,
    title: '독서일지 제출',
    desc: '도서명, 저자, 출판사, 읽은 페이지 수를 입력합니다. 페이지 수는 거리로 자동 환산됩니다.',
  },
  {
    no: 4,
    title: '현황 확인',
    desc: '누적 거리, 달성률, 완주 여부와 공지사항을 대회 현황에서 확인합니다.',
  },
];

export const FALLBACK_NOTICES: FallbackNotice[] = [
  {
    badge: '신청',
    title: '제5회 독서마라톤 참가 신청 안내',
    href: '#process',
    date: '2025.11.24',
    dateTime: '2025-11-24',
  },
  {
    badge: '코스',
    title: '코스별 완주 기준 및 혜택 안내',
    href: '#courses',
    date: '2025.11.24',
    dateTime: '2025-11-24',
  },
  {
    badge: '기록',
    title: '독서일지 제출 및 인정 기준 안내',
    href: '#process',
    date: '2025.12.08',
    dateTime: '2025-12-08',
  },
  {
    badge: '문의',
    title: '서평 작성 및 문의 채널 안내',
    href: '#contact',
    date: '2025.12.08',
    dateTime: '2025-12-08',
  },
];

export const CHECK_ITEMS = [
  '독서일지에는 도서 정보와 읽은 페이지 수를 정확히 입력해야 합니다.',
  '만화, 전공서적, 수험서, 원서, 정기간행물 등은 인정 대상에서 제외될 수 있습니다.',
  '서평은 도서관 홈페이지 로그인 후 해당 도서 상세페이지에서 작성합니다.',
  '상금 및 문화상품권 지급 대상과 기준은 도서관 공지사항을 따릅니다.',
];

/** 참가 정보 조회 전(또는 실패 시) 나의 기록 카드에 표시하는 fallback 값 */
export const FALLBACK_MY_RECORD: MyRecordSummary = {
  course: '하프코스',
  targetDistance: 21100,
  totalDistance: 4025,
  totalPages: 805,
  approvedLogs: 4,
  lastSubmittedAt: '2025. 12. 18.',
};

/** 서버 코스 정보를 코스 및 혜택 표 행으로 변환합니다. */
export function toCourseRow(course: EventCourse): CourseRow {
  return {
    name: course.name,
    distance: `${course.targetDistanceMeter.toLocaleString()}m`,
    pages: `${Math.ceil(course.targetDistanceMeter / METERS_PER_PAGE).toLocaleString()}쪽`,
    books: `${course.standardBookCount}권`,
    monthly: `${course.avgMonthlyReadingCount}권`,
    reward:
      course.rewardAmount > 0
        ? `${course.rewardType} ${course.rewardAmount.toLocaleString()}원`
        : course.rewardType,
    loan: `${course.extraLoanCount}권`,
    people: `${course.maxWinners}명`,
  };
}
