import { describe, expect, it } from 'vitest';
import { rosterKey, rosterStatus, type RosterRow } from '../src/api/adminRosterApi';
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  EMPTY_FILTERS,
  matchesRosterRow,
  rosterCell,
  sortedRoster,
} from '../src/utils/participantRoster';

const entry: RosterRow = {
  serialNo: 12,
  applicationId: 8,
  participationId: 8,
  eventId: 1,
  courseId: 3,
  courseName: '하프 코스',
  studentNo: '20260001',
  name: '김지안',
  email: 'Jian@example.test',
  phone: '010-1111-1111',
  affiliationType: 'UNDERGRADUATE',
  department: '영어학과',
  college: '영어대학',
  grade: '2',
  gender: null,
  applicationStatus: 'APPROVED',
  participationStatus: 'COMPLETED',
  registeredAt: '2026-11-23T10:00:00',
  rejectReason: null,
};

describe('관리자 참가자 명단', () => {
  it('같은 숫자의 신청서와 직접 등록 참가자를 따로 선택한다', () => {
    expect(rosterKey({ ...entry, applicationId: null })).not.toBe(
      rosterKey({ ...entry, participationId: null }),
    );
    expect(rosterKey({ ...entry, serialNo: 13 })).toBe(rosterKey(entry));
  });
  it('승인 이후의 완주, 실격 등 현재 참가 상태를 사용한다', () => {
    expect(rosterStatus(entry)).toBe('COMPLETED');
    expect(matchesRosterRow(entry, { ...EMPTY_FILTERS, status: 'APPROVED' })).toBe(false);
    expect(
      matchesRosterRow(
        { ...entry, participationStatus: 'DISQUALIFIED' },
        { ...EMPTY_FILTERS, status: 'DISQUALIFIED' },
      ),
    ).toBe(true);
  });
  it('검색 범위와 복수 조건을 동시에 적용한다', () => {
    expect(
      matchesRosterRow(entry, {
        query: ' jian@ ',
        status: 'COMPLETED',
        course: '3',
        affiliation: 'UNDERGRADUATE',
      }),
    ).toBe(true);
    for (const query of ['영어대학', '영어학과', '010-1111'])
      expect(matchesRosterRow(entry, { ...EMPTY_FILTERS, query })).toBe(true);
    expect(matchesRosterRow(entry, { ...EMPTY_FILTERS, query: '영어', course: '4' })).toBe(false);
  });
});

describe('참가 명단의 표시 순번과 정렬', () => {
  const pending = {
    ...entry,
    name: '가진',
    participationId: null,
    participationStatus: null,
    applicationStatus: 'APPLIED' as const,
  };
  const approved = {
    ...entry,
    name: '강민아',
    studentNo: '0020',
    participationStatus: 'APPROVED' as const,
  };
  const completed = { ...entry, name: '최서연', studentNo: '0002' };
  it('기본 조회에서 승인·완주만 가나다순으로 번호를 부여한다', () => {
    const rows = sortedRoster([completed, pending, approved], DEFAULT_FILTERS, DEFAULT_SORT);
    expect(rows.map((r) => [r.number, r.name])).toEqual([
      [1, '강민아'],
      [2, '최서연'],
    ]);
    expect(sortedRoster([completed, pending, approved], EMPTY_FILTERS, DEFAULT_SORT)).toHaveLength(
      3,
    );
  });
  it('정렬·필터를 적용한 결과의 위치에 순번을 매긴다', () => {
    const rows = [approved, pending, completed];
    const byStudentNo = sortedRoster(rows, DEFAULT_FILTERS, {
      column: 'studentNo',
      direction: 'ascending',
    });
    expect(byStudentNo.map((r) => [r.number, r.studentNo])).toEqual([
      [1, '0002'],
      [2, '0020'],
    ]);
    const byNameDesc = sortedRoster(rows, DEFAULT_FILTERS, {
      column: 'name',
      direction: 'descending',
    });
    expect(byNameDesc.map((r) => [r.number, r.name])).toEqual([
      [1, '최서연'],
      [2, '강민아'],
    ]);
    const one = sortedRoster(rows, { ...DEFAULT_FILTERS, query: '최서연' }, DEFAULT_SORT);
    expect(one.map((r) => r.number)).toEqual([1]);
  });
  it('연락처는 화면에서 일정한 형태로 표시하고 하이픈 유무와 관계없이 검색한다', () => {
    const row = { ...entry, number: 1, phone: '01012345678' };
    expect(rosterCell(row, 'phone')).toBe('010-1234-5678');
    expect(matchesRosterRow(row, { ...DEFAULT_FILTERS, query: '010-1234' })).toBe(true);
    expect(rosterCell({ ...row, phone: '02-123-4567' }, 'phone')).toBe('02-123-4567');
  });
});
