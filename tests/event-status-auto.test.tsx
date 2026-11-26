import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import EventStatusIndicator from '../src/components/admin/eventSettings/EventStatusIndicator';
import { isManualEventStatus } from '../src/types/adminEvent';
import { EMPTY_EVENT_FORM, toEventRequest } from '../src/utils/adminEventForms';

const form = {
  ...EMPTY_EVENT_FORM,
  title: '제6회 독서마라톤',
  roundNo: '6',
  applicationStartDate: '2026-12-01',
  applicationEndDate: '2027-01-31',
  eventStartDate: '2026-12-07',
  eventEndDate: '2027-01-31',
};

describe('행사 운영 상태 자동 관리(서버 응답 기준)', () => {
  it('저장 요청에는 상태를 싣지 않고, 최종 확정·보관 요청만 보낸다', () => {
    expect('status' in toEventRequest(form)).toBe(false);
    for (const status of ['READY', 'APPLICATION_OPEN', 'IN_PROGRESS', 'ENDED', 'DRAFT'] as const) {
      expect('status' in toEventRequest({ ...form, status })).toBe(false);
    }
    expect(toEventRequest({ ...form, status: 'FINALIZED' }).status).toBe('FINALIZED');
    expect(toEventRequest({ ...form, status: 'ARCHIVED' }).status).toBe('ARCHIVED');
  });

  it('수동 관리 상태는 작성 중·최종 확정·보관뿐이다', () => {
    expect(isManualEventStatus('DRAFT')).toBe(true);
    expect(isManualEventStatus('FINALIZED')).toBe(true);
    expect(isManualEventStatus('ARCHIVED')).toBe(true);
    for (const status of [
      'READY',
      'APPLICATION_OPEN',
      'APPLICATION_CLOSED',
      'IN_PROGRESS',
      'ENDED',
    ] as const) {
      expect(isManualEventStatus(status)).toBe(false);
    }
  });

  it('진행 중은 초록, 신청 접수 중은 파랑, 나머지는 회색 표시등과 자동 변경 안내를 보인다', () => {
    const html = (status: Parameters<typeof EventStatusIndicator>[0]['status']) =>
      renderToStaticMarkup(<EventStatusIndicator status={status} />);
    expect(html('IN_PROGRESS')).toContain('is-green');
    expect(html('IN_PROGRESS')).toContain('진행 중');
    expect(html('IN_PROGRESS')).not.toContain('자동 관리');
    expect(html('IN_PROGRESS')).toContain('설정한 행사 기간에 따라 자동 변경됩니다.');
    expect(html('APPLICATION_OPEN')).toContain('is-blue');
    for (const status of ['READY', 'APPLICATION_CLOSED', 'ENDED'] as const) {
      expect(html(status)).toContain('is-gray');
      expect(html(status)).not.toContain('자동 관리');
    }
    // 수동 관리 상태만 '수동 관리' 표시를 남긴다
    for (const status of ['DRAFT', 'FINALIZED', 'ARCHIVED'] as const) {
      expect(html(status)).toContain('수동 관리');
    }
    // 아직 저장하지 않은 새 행사
    expect(html(null)).toContain('저장 후 표시');
    expect(html('IN_PROGRESS')).not.toContain('<select');
  });
});
