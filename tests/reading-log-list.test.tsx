import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import ReadingLogQueueList from '../src/components/admin/readingLogs/ReadingLogQueueList';
import {
  DEFAULT_LOG_SORT,
  INITIAL_LOG_SEARCH,
  logColumnWidths,
  visibleLogColumns,
  visibleLogs,
  type LogSort,
} from '../src/components/admin/readingLogs/readingLogTable';
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
      sort={DEFAULT_LOG_SORT}
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
      onSort={vi.fn()}
      onReset={vi.fn()}
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
  expect(headings).toEqual([
    '',
    '순번',
    '이름',
    '학번·사번',
    '제출일',
    '도서명',
    '저자',
    '쪽수',
    '상세',
  ]);
  expect(html).toContain('11번 김도서 2026-11-23 제출 일지 선택');
  expect(html).not.toContain(submitted.readingDate);
  expect(html).toMatch(/<td[^>]*data-column="userName"[^>]*><span>김도서<\/span>/);
  expect(html).toContain('aria-label="11번 김도서 일지 자세히"');
  expect(html).toContain('role="separator"');
  expect(html).toContain('aria-label="도서명 열 너비"');
});

it('전체 목록은 상태를 표시하고 승인할 수 없는 행을 선택 수에서 제외한다', () => {
  const html = list('ALL');
  expect(html).toContain('title="상태 오름차순 정렬"');
  expect(html).toContain('선택 승인 (1건)');
  expect(html).toMatch(/<input[^>]*aria-label="12번 [^"]*"[^>]*disabled[^>]*>/);
  expect(html).not.toMatch(/<input[^>]*aria-label="12번 [^"]*"[^>]*checked[^>]*>/);
});

it('전체 결과에서 가나다순·숫자순으로 정렬하고 동률은 제출 순서로 구분한다', () => {
  const first = { ...submitted, userName: '강민', studentNo: '9', totalReadPages: 101 };
  const second = {
    ...submitted,
    readingLogId: 18,
    userName: '하나',
    studentNo: '10',
    totalReadPages: 7,
  };
  const third = {
    ...submitted,
    readingLogId: 19,
    userName: '강민',
    studentNo: '12',
    totalReadPages: 34,
  };
  const sorted = (column: LogSort['column'], direction: LogSort['direction']) =>
    visibleLogs([third, second, first], { ...INITIAL_LOG_SEARCH, sort: { column, direction } }).map(
      (r) => r.readingLogId,
    );
  expect(sorted('userName', 'ascending')).toEqual([17, 19, 18]);
  expect(sorted('studentNo', 'ascending')).toEqual([17, 18, 19]);
  expect(sorted('totalReadPages', 'descending')).toEqual([17, 19, 18]);
});

it('넓은 화면의 여유 폭을 나누고, 한 열을 직접 조절해도 체크박스와 상세 버튼 공간을 확보한다', () => {
  const cols = visibleLogColumns(false);
  const total = (widths: ReturnType<typeof logColumnWidths>) =>
    28 + 80 + cols.reduce((sum, key) => sum + widths[key], 0);
  for (const viewport of [980, 1144, 1624]) {
    const widths = logColumnWidths(cols, viewport, {});
    expect(total(widths)).toBe(viewport);
    expect(widths.bookTitle / viewport).toBeLessThan(0.3);
    const resized = logColumnWidths(cols, viewport, { bookTitle: widths.bookTitle - 30 });
    expect(resized.bookTitle).toBe(widths.bookTitle - 30);
    expect(total(resized)).toBe(viewport);
  }
});
