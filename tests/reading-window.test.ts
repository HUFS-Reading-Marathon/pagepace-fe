import { describe, expect, it } from 'vitest';
import { canSubmitReadingLog } from '../src/utils/eventSelection';

const round = {
  eventStatus: 'IN_PROGRESS',
  participationStatus: 'APPROVED' as const,
  eventStartDate: '2026-12-28',
  eventEndDate: '2027-02-28',
};
describe('선택한 참가 회차의 일지·도서 확인 요청 접수 기간', () => {
  it('개시일과 마지막 날에 접수하며 행사 시작 전과 마감 뒤에는 내역으로 이동한다', () => {
    expect(canSubmitReadingLog(round, '2026-12-27')).toBe(false);
    expect(canSubmitReadingLog(round, '2026-12-28')).toBe(true);
    expect(canSubmitReadingLog(round, '2027-02-28')).toBe(true);
    expect(canSubmitReadingLog(round, '2027-03-01')).toBe(false);
  });
  it.each(['DRAFT', 'ENDED', 'FINALIZED', 'ARCHIVED'])(
    '%s 상태에서는 날짜가 겹쳐도 쓰기를 열지 않는다',
    (eventStatus) => {
      expect(canSubmitReadingLog({ ...round, eventStatus }, '2027-01-05')).toBe(false);
    },
  );
  it('승인·완주 참가자만 일지를 제출할 수 있다', () => {
    expect(canSubmitReadingLog({ ...round, participationStatus: 'COMPLETED' }, '2027-01-05')).toBe(
      true,
    );
    expect(canSubmitReadingLog({ ...round, participationStatus: 'CANCELLED' }, '2027-01-05')).toBe(
      false,
    );
    expect(
      canSubmitReadingLog({ ...round, participationStatus: 'DISQUALIFIED' }, '2027-01-05'),
    ).toBe(false);
  });
});
