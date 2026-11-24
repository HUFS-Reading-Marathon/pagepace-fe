import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import ReadingLogQueueList from '../src/components/admin/readingLogs/ReadingLogQueueList';
import TablePagination from '../src/components/admin/table/TablePagination';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  clampPage,
} from '../src/components/admin/table/pagination';
import {
  DEFAULT_LOG_SORT,
  INITIAL_LOG_SEARCH,
  hasLogFilters,
  logColumnWidths,
  logCourseOptions,
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
      from=""
      to=""
      course=""
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
      onDates={vi.fn()}
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

it('제출 기간(양 끝 포함)과 코스로 거르고, 불러온 일지에 있는 코스만 선택지로 쓴다', () => {
  const day = (id: number, createdAt: string, courseName = '단축') => ({
    ...submitted,
    readingLogId: id,
    createdAt,
    courseName,
  });
  const logs = [
    day(1, '2026-11-01T09:00:00'),
    day(2, '2026-11-02T23:59:59', '풀'),
    day(3, '2026-11-03T00:00:00'),
    day(4, '2026-11-04T10:00:00', '풀'),
  ];
  const ids = (patch: Partial<typeof INITIAL_LOG_SEARCH>) =>
    visibleLogs(logs, { ...INITIAL_LOG_SEARCH, ...patch }).map((log) => log.readingLogId);
  expect(ids({ from: '2026-11-02', to: '2026-11-03' })).toEqual([2, 3]);
  expect(ids({ from: '2026-11-03' })).toEqual([3, 4]);
  expect(ids({ to: '2026-11-01' })).toEqual([1]);
  expect(ids({ course: '풀' })).toEqual([2, 4]);
  expect(ids({ course: '풀', from: '2026-11-03' })).toEqual([4]);
  expect(logCourseOptions(logs)).toEqual(['단축', '풀']);
  expect(hasLogFilters(INITIAL_LOG_SEARCH)).toBe(false);
  expect(hasLogFilters({ ...INITIAL_LOG_SEARCH, course: '풀' })).toBe(true);
});

it('기본 정렬은 제출 오래된 순이고 같은 제출 시각은 일지 번호로 고정한다', () => {
  const same = '2026-11-02T10:00:00';
  const logs = [30, 10, 20].map((id) => ({ ...submitted, readingLogId: id, createdAt: same }));
  const older = { ...submitted, readingLogId: 99, createdAt: '2026-11-01T10:00:00' };
  expect(visibleLogs([...logs, older], INITIAL_LOG_SEARCH).map((log) => log.readingLogId)).toEqual([
    99, 10, 20, 30,
  ]);
});

it('페이지는 기본 20건이고 10·20·50건을 고를 수 있으며 현재 범위와 전체 건수를 보여 준다', () => {
  expect(DEFAULT_PAGE_SIZE).toBe(20);
  expect(PAGE_SIZE_OPTIONS).toEqual([10, 20, 50]);
  // 처리로 행이 줄어 마지막 페이지가 비면 남은 마지막 페이지로 보정한다
  expect(clampPage(6, 120, 20)).toBe(5);
  expect(clampPage(6, 121, 20)).toBe(6);
  expect(clampPage(3, 0, 20)).toBe(0);
  const html = renderToStaticMarkup(
    <TablePagination
      total={125}
      page={6}
      pageSize={20}
      label="일지 페이지"
      onPage={vi.fn()}
      onPageSize={vi.fn()}
    />,
  );
  expect(html).toContain('121–125 / 125건');
  expect(html).toMatch(/aria-label="7페이지" aria-current="page"/);
  expect(html).toMatch(/aria-label="다음 페이지" disabled=""/);
  for (const size of [10, 20, 50]) expect(html).toContain(`<option value="${size}"`);
});

it('검색 영역에 코스·제출 기간·초기화·새로고침을 함께 둔다', () => {
  const html = renderToStaticMarkup(
    <ReadingLogQueueList
      rows={[submitted]}
      total={1}
      page={0}
      pageSize={20}
      filter="SUBMITTED"
      query=""
      from="2026-11-01"
      to="2026-11-30"
      course=""
      courseOptions={['단축', '풀']}
      sort={DEFAULT_LOG_SORT}
      selected={null}
      selectedIds={new Set()}
      loading={false}
      processing={false}
      error=""
      feedback=""
      canSelect={() => true}
      onSelectionChange={vi.fn()}
      onApproveSelection={vi.fn()}
      onFilter={vi.fn()}
      onQuery={vi.fn()}
      onDates={vi.fn()}
      onCourse={vi.fn()}
      onSort={vi.fn()}
      onReset={vi.fn()}
      onPage={vi.fn()}
      onSelect={vi.fn()}
      onRefresh={vi.fn()}
      renderDetail={() => null}
    />,
  );
  expect(html).toMatch(/<option value=""[^>]*>전체 코스<\/option>/);
  expect(html).toContain('aria-label="제출 기간 시작일"');
  expect(html).toMatch(/aria-label="제출 기간 종료일" min="2026-11-01"/);
  expect(html).toContain('>새로고침</button>');
  expect(html).toContain('검색 결과 <b>1</b>건');
});
