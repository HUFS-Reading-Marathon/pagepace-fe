import { describe, expect, it } from 'vitest';
import {
  EMPTY_EVENT_FORM,
  eventTitleForRound,
  isValidRoundNo,
  toEventRequest,
  validateEventForm,
} from '../src/utils/adminEventForms';

const filled = {
  ...EMPTY_EVENT_FORM,
  roundNo: '7',
  title: eventTitleForRound(7),
  applicationStartDate: '2027-03-01',
  applicationEndDate: '2027-03-15',
  eventStartDate: '2027-03-20',
  eventEndDate: '2027-05-31',
};

describe('행사 회차와 자동 행사명', () => {
  it('회차 숫자로 "제N회 독서마라톤" 행사명을 만든다', () => {
    expect(eventTitleForRound(7)).toBe('제7회 독서마라톤');
    expect(eventTitleForRound('12')).toBe('제12회 독서마라톤');
  });

  it('회차는 1 이상의 정수만 받는다', () => {
    for (const value of ['1', '7', '07', '120']) expect(isValidRoundNo(value)).toBe(true);
    for (const value of ['', ' ', '0', '-1', '1.5', '1e2', '+3', 'abc', '1234567'])
      expect(isValidRoundNo(value)).toBe(false);
  });

  it('빈 값·잘못된 값·다른 행사와 겹치는 회차를 저장 전에 막는다', () => {
    expect(validateEventForm({ ...filled, roundNo: '' })).toBe('회차를 입력해 주세요.');
    expect(validateEventForm({ ...filled, roundNo: '0' })).toBe(
      '회차는 1 이상의 정수로 입력해 주세요.',
    );
    expect(validateEventForm({ ...filled, roundNo: '2.5' })).toBe(
      '회차는 1 이상의 정수로 입력해 주세요.',
    );
    expect(validateEventForm(filled, [5, 7])).toBe(
      '제7회 행사가 이미 있습니다. 다른 회차를 입력해 주세요.',
    );
    expect(validateEventForm(filled, [5, 6])).toBeNull();
  });

  it('저장 요청에는 행사명과 회차를 함께 보내고, 저장된 행사명은 그대로 둔다', () => {
    expect(toEventRequest(filled)).toMatchObject({ title: '제7회 독서마라톤', roundNo: 7 });
    // 회차를 바꾸지 않은 기존 행사는 서버에 저장된 행사명을 그대로 보냅니다.
    expect(
      toEventRequest({ ...filled, roundNo: '8', title: '제8회 독서마라톤 (대량 검증)' }).title,
    ).toBe('제8회 독서마라톤 (대량 검증)');
  });
});
