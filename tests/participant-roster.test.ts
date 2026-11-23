import { describe, expect, it } from 'vitest';
import { rosterKey, rosterStatus, type RosterRow } from '../src/api/adminRosterApi';
import { EMPTY_FILTERS, matchesRosterRow } from '../src/utils/participantRoster';

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
