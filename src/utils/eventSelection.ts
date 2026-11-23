import type { MyParticipation } from '../types/participation';
export type EventScope = 'personal' | 'public' | 'admin';
const key = (scope: EventScope) => `pagepace:${scope}:event`;
export function selectedEventId(scope: EventScope): number | undefined {
  const value = Number(sessionStorage.getItem(key(scope)));
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}
export function selectEvent(scope: EventScope, id?: number) {
  if (id) sessionStorage.setItem(key(scope), String(id));
  else sessionStorage.removeItem(key(scope));
  window.dispatchEvent(new Event('pagepace:event-selection'));
}
export function eventQuery(id?: number) {
  return id ? `?eventId=${id}` : '';
}
export function preferredAdminEvent<T extends { eventId: number; status: string }>(events: T[]) {
  return (
    events.find((event) => event.eventId === selectedEventId('admin')) ??
    events.find((event) => event.status === 'IN_PROGRESS') ??
    events.find((event) => event.status === 'APPLICATION_OPEN') ??
    events[0]
  );
}
export function koreaToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (name: string) => parts.find((part) => part.type === name)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
type ApplicationEvent = {
  status: string;
  applicationStartDate: string;
  applicationEndDate: string;
};

export function canApply(event: ApplicationEvent | null, today = koreaToday()) {
  return (
    !!event &&
    event.status === 'APPLICATION_OPEN' &&
    today >= event.applicationStartDate &&
    today <= event.applicationEndDate
  );
}

/**
 * 참가신청이 왜 불가능한지 화면 안내용으로 구분합니다.
 * 신청 가능 여부 판정은 canApply와 같고(최종 검증은 서버), 이 함수는 사유만 나눕니다.
 */
export type ApplicationAvailability =
  | { state: 'open' }
  | { state: 'none' }
  | { state: 'before'; startDate: string }
  | { state: 'after'; endDate: string }
  | { state: 'notStarted' }
  | { state: 'closed' };

const PRE_APPLICATION_STATUSES = ['DRAFT', 'READY'];

export function getApplicationAvailability(
  event: ApplicationEvent | null,
  today = koreaToday(),
): ApplicationAvailability {
  if (!event) return { state: 'none' };
  if (canApply(event, today)) return { state: 'open' };
  if (today < event.applicationStartDate) {
    return { state: 'before', startDate: event.applicationStartDate };
  }
  if (today > event.applicationEndDate) {
    return { state: 'after', endDate: event.applicationEndDate };
  }
  // 신청기간 안이지만 서버 상태가 신청 접수 중이 아닌 경우
  return PRE_APPLICATION_STATUSES.includes(event.status)
    ? { state: 'notStarted' }
    : { state: 'closed' };
}

/** "2026-09-19"를 문장 안에 쓰기 좋은 "2026년 9월 19일"로 바꿉니다. */
function formatSentenceDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return year && month && day ? `${year}년 ${month}월 ${day}일` : value;
}

/** 신청 불가 사유를 사용자 안내 문구로 바꿉니다. */
export function getApplicationClosedMessage(
  availability: Exclude<ApplicationAvailability, { state: 'open' }>,
) {
  switch (availability.state) {
    case 'none':
      return '현재 참가신청을 받는 독서마라톤 행사가 없습니다.';
    case 'before':
      return `참가신청은 ${formatSentenceDate(availability.startDate)}부터 받습니다.`;
    case 'after':
      return `참가신청이 ${formatSentenceDate(availability.endDate)}에 마감되었습니다.`;
    case 'notStarted':
      return '아직 참가신청을 받지 않습니다.';
    case 'closed':
      return '참가신청이 마감되었습니다.';
  }
}

export function canSubmitReadingLog(
  participation: Pick<
    MyParticipation,
    'participationStatus' | 'eventStatus' | 'eventStartDate' | 'eventEndDate'
  >,
  today = koreaToday(),
) {
  return (
    ['APPROVED', 'COMPLETED'].includes(participation.participationStatus) &&
    !['DRAFT', 'ENDED', 'FINALIZED', 'ARCHIVED'].includes(participation.eventStatus) &&
    today >= participation.eventStartDate &&
    today <= participation.eventEndDate
  );
}

export function hasFinalResults(eventStatus?: string) {
  return eventStatus === 'FINALIZED' || eventStatus === 'ARCHIVED';
}
