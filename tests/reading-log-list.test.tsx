import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import ReadingLogQueueList from '../src/components/admin/readingLogs/ReadingLogQueueList';
import type { AdminReadingLogResponse } from '../src/types/adminReadingLogApi';

const submitted: AdminReadingLogResponse = {
  readingLogId: 17,
  eventId: 1,
  eventTitle: '독서마라톤',
  participationId: 2,
  userId: 3,
  userName: '김도서',
  studentNo: '20260001',
  courseId: 1,
  courseName: '단축',
  readingDate: '2026-11-20',
  createdAt: '2026-11-23T14:10:00',
  updatedAt: '2026-11-23T14:10:00',
  status: 'SUBMITTED',
  totalReadPages: 25,
  convertedDistanceMeter: 0,
  adminComment: null,
  reviewedAt: null,
  recommendedRejectReasons: [],
  books: [],
};

function list(filter: 'ALL' | 'SUBMITTED') {
  const reviewed: AdminReadingLogResponse = { ...submitted, readingLogId: 18, status: 'APPROVED' };
  const rows = filter === 'ALL' ? [submitted, reviewed] : [submitted];
  return renderToStaticMarkup(
    <ReadingLogQueueList
      rows={rows}
      total={10 + rows.length}
      page={1}
      pageSize={10}
      filter={filter}
      query=""
      date=""
      order="oldest"
      selected={null}
      selectedIds={new Set([17, 18])}
      loading={false}
      processing={false}
      error=""
      feedback=""
      canSelect={(log) => log.status === 'SUBMITTED'}
      onSelectionChange={vi.fn()}
      onApproveSelection={vi.fn()}
      onFilter={vi.fn()}
      onQuery={vi.fn()}
      onDate={vi.fn()}
      onOrder={vi.fn()}
      onPage={vi.fn()}
      onSelect={vi.fn()}
      renderDetail={() => null}
    />,
  );
}

it('제출일만 보여 주고 순번·이름·학번 다음에 제출일과 도서 정보를 둔다', () => {
  const html = list('SUBMITTED');
  const headings = Array.from(
    html.match(/<thead>(.*?)<\/thead>/s)![1].matchAll(/<th\b[^>]*>(.*?)<\/th>/gs),
    (match) => match[1].replace(/<[^>]*>/g, ''),
  );
  expect(headings).toEqual(['', '순번', '이름', '학번·사번', '제출일', '도서명', '쪽수']);
  expect(html).toContain('11번 김도서 2026-11-23 제출 일지 선택');
  expect(html).not.toContain(submitted.readingDate);
});

it('전체 목록은 상태를 표시하고 승인할 수 없는 행을 선택 수에서 제외한다', () => {
  const html = list('ALL');
  expect(html).toContain('>상태</th><th scope="col">도서명</th>');
  expect(html).toContain('선택 승인 (1건)');
  expect(html).toMatch(/<input[^>]*aria-label="12번 [^"]*"[^>]*disabled[^>]*>/);
  expect(html).not.toMatch(/<input[^>]*aria-label="12번 [^"]*"[^>]*checked[^>]*>/);
});
