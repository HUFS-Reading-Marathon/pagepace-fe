import { toCsv } from '../src/utils/csv';
import { describeEventCountdown } from '../src/utils/adminEventForms';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canApply,
  getApplicationAvailability,
  getApplicationClosedMessage,
  koreaToday,
  preferredAdminEvent,
  selectEvent,
  selectedEventId,
} from '../src/utils/eventSelection';
import {
  buildAdminCompetitionRows,
  getAdminCompetitionCourseSummaries,
} from '../src/utils/statusAggregation';
import type { AdminParticipation } from '../src/api/adminParticipationApi';
import type { AdminReadingLogResponse } from '../src/types/adminReadingLogApi';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  vi.stubGlobal('window', new EventTarget());
});
describe('행사 선택과 신청 기간', () => {
  it('한국 자정에 날짜가 전환된다', () => {
    expect(koreaToday(new Date('2026-10-29T14:59:59Z'))).toBe('2026-10-29');
    expect(koreaToday(new Date('2026-10-29T15:00:00Z'))).toBe('2026-10-30');
  });
  it('접수 상태와 양 끝 날짜를 모두 검증한다', () => {
    const event = {
      status: 'APPLICATION_OPEN',
      applicationStartDate: '2026-10-01',
      applicationEndDate: '2026-10-30',
    };
    expect(canApply(event, '2026-10-01')).toBe(true);
    expect(canApply(event, '2026-10-30')).toBe(true);
    expect(canApply(event, '2026-10-31')).toBe(false);
    expect(canApply({ ...event, status: 'ENDED' }, '2026-10-20')).toBe(false);
  });
  it('신청 불가 사유를 canApply와 같은 기준으로 구분한다', () => {
    const event = {
      status: 'APPLICATION_OPEN',
      applicationStartDate: '2026-10-01',
      applicationEndDate: '2026-10-30',
    };
    expect(getApplicationAvailability(null).state).toBe('none');
    expect(getApplicationAvailability(event, '2026-10-15').state).toBe('open');
    expect(getApplicationAvailability(event, '2026-09-30')).toEqual({
      state: 'before',
      startDate: '2026-10-01',
    });
    expect(getApplicationAvailability(event, '2026-10-31')).toEqual({
      state: 'after',
      endDate: '2026-10-30',
    });
    expect(getApplicationAvailability({ ...event, status: 'READY' }, '2026-10-15').state).toBe(
      'notStarted',
    );
    expect(
      getApplicationAvailability({ ...event, status: 'APPLICATION_CLOSED' }, '2026-10-15').state,
    ).toBe('closed');
    expect(getApplicationClosedMessage({ state: 'after', endDate: '2026-10-30' })).toBe(
      '참가신청이 2026년 10월 30일에 마감되었습니다.',
    );
  });
  it('관리자와 개인 행사 선택은 서로 영향을 주지 않는다', () => {
    selectEvent('personal', 2);
    selectEvent('admin', 1);
    expect(selectedEventId('personal')).toBe(2);
    expect(
      preferredAdminEvent([
        { eventId: 2, status: 'IN_PROGRESS' },
        { eventId: 1, status: 'ENDED' },
      ])?.eventId,
    ).toBe(1);
    selectEvent('admin', 999);
    expect(preferredAdminEvent([{ eventId: 2, status: 'IN_PROGRESS' }])?.eventId).toBe(2);
  });
  it('잘못된 저장된 행사 번호를 사용하지 않는다', () => {
    sessionStorage.setItem('pagepace:personal:event', '-1');
    expect(selectedEventId('personal')).toBeUndefined();
    sessionStorage.setItem('pagepace:personal:event', 'NaN');
    expect(selectedEventId('personal')).toBeUndefined();
  });
});
describe('실제 참가 기록 기반 관리자 집계', () => {
  const participant = {
    participationId: 1,
    eventId: 1,
    courseId: 10,
    courseName: '단축',
    userId: 1,
    studentNo: 'demo',
    name: '테스트',
    department: null,
    affiliationType: 'UNDERGRADUATE',
    status: 'APPROVED',
    totalPages: 100,
    totalDistanceMeter: 400,
  } satisfies AdminParticipation;
  const courses = [
    {
      courseId: 10,
      name: '단축',
      targetDistanceMeter: 1000,
      standardBookCount: 1,
      avgMonthlyReadingCount: 1,
      maxWinners: 5,
      extraLoanCount: 1,
      rewardType: 'NONE',
      rewardAmount: 0,
      displayOrder: 1,
    },
  ];
  const logs = [
    {
      participationId: 1,
      courseId: 99,
      status: 'APPROVED',
      readingDate: '2026-10-30',
      totalReadPages: 20,
      reviewedAt: '2026-10-30T10:00:00',
    },
    {
      participationId: 77,
      courseId: 10,
      status: 'APPROVED',
      readingDate: '2026-10-30',
      totalReadPages: 999,
    },
  ] as AdminReadingLogResponse[];
  it('0쪽 직접 등록 참가자를 포함하고 취소자는 제외한다', () => {
    const rows = buildAdminCompetitionRows(
      [
        participant,
        { ...participant, participationId: 2, totalPages: 0, totalDistanceMeter: 0 },
        { ...participant, participationId: 3, status: 'CANCELLED' },
      ],
      logs,
      courses,
      '2026-10-30',
    );
    expect(rows).toHaveLength(2);
    expect(rows[1].approvedLogCount).toBe(0);
    expect(getAdminCompetitionCourseSummaries(rows, courses)[0].participantCount).toBe(2);
  });
  it('승인 100쪽이어도 서평 인정 거리 400m를 사용한다', () => {
    const row = buildAdminCompetitionRows([participant], logs, courses, '2026-10-30')[0];
    expect(row.cumulativePages).toBe(100);
    expect(row.cumulativeDistanceMeters).toBe(400);
    expect(row.progressRate).toBe(40);
    expect(row.dailyIncreasePages).toBe(20);
  });
  it('조회 날짜는 일일 독서량에만 적용하고 누적은 현재 서버 집계를 유지한다', () => {
    const row = buildAdminCompetitionRows([participant], logs, courses, '2026-10-29')[0];
    expect(row.dailyIncreasePages).toBe(0);
    expect(row.cumulativePages).toBe(100);
  });
  it('완주는 서버 참가 상태로 판정한다', () => {
    const rows = buildAdminCompetitionRows(
      [{ ...participant, status: 'COMPLETED' }],
      logs,
      courses,
      '2026-10-30',
    );
    expect(getAdminCompetitionCourseSummaries(rows, courses)[0].completedCount).toBe(1);
  });
});

it('CSV는 쉼표·따옴표·줄바꿈을 보존하고 수식 입력을 이스케이프한다', () => {
  expect(toCsv([['가,나', 'a"b', '=1+1', 42]])).toBe('\uFEFF"가,나","a""b","\'=1+1","42"');
});

describe('행사 설정 카운트다운 라벨', () => {
  it('값과 같은 기준 날짜로 라벨을 정한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 17, 12));
    try {
      expect(describeEventCountdown('2026-11-20', '2026-12-12')).toEqual({
        label: '행사 시작까지',
        value: 'D-3',
        date: 'start',
      });
      expect(describeEventCountdown('2026-11-17', '2026-12-12').label).toBe('행사 시작일');
      expect(describeEventCountdown('2026-09-22', '2026-12-12')).toEqual({
        label: '행사 기간',
        value: '행사 진행 중',
        date: 'end',
      });
      expect(describeEventCountdown('2026-03-02', '2026-06-12').value).toBe('행사 종료');
      expect(describeEventCountdown('', '').date).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
