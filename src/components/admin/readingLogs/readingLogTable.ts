import type { AdminReadingLogResponse } from '../../../types/adminReadingLogApi';
import { READING_LOG_STATUS_LABELS } from '../../../types/readingLog';
import { CHECK_WIDTH, distributeWidths } from '../table/tableColumns';

export const LOG_COLUMNS = {
  number: '순번',
  userName: '이름',
  studentNo: '학번·사번',
  createdAt: '제출일',
  status: '상태',
  bookTitle: '도서명',
  author: '저자',
  totalReadPages: '쪽수',
} as const;
export type LogColumn = keyof typeof LOG_COLUMNS;
export type LogSort = {
  column: Exclude<LogColumn, 'number'>;
  direction: 'ascending' | 'descending';
};
/** 검색 조건. 제출 기간(from~to)은 제출일(createdAt) 기준이며 양 끝을 포함합니다. */
export type LogSearch = { query: string; from: string; to: string; course: string; sort: LogSort };
export const DEFAULT_LOG_SORT: LogSort = { column: 'createdAt', direction: 'ascending' };
export const INITIAL_LOG_SEARCH: LogSearch = {
  query: '',
  from: '',
  to: '',
  course: '',
  sort: DEFAULT_LOG_SORT,
};

export function hasLogFilters({ query, from, to, course }: LogSearch) {
  return !!(query.trim() || from || to || course);
}

/** 불러온 일지에 실제로 있는 코스만 코스 필터 선택지로 씁니다. */
export function logCourseOptions(logs: AdminReadingLogResponse[]) {
  return [...new Set(logs.map((log) => log.courseName).filter(Boolean))].sort((a, b) =>
    collator.compare(a, b),
  );
}
export const DETAIL_WIDTH = 80;

const withStatus = Object.keys(LOG_COLUMNS) as LogColumn[];
const withoutStatus = withStatus.filter((key) => key !== 'status');
export function visibleLogColumns(showStatus: boolean) {
  return showStatus ? withStatus : withoutStatus;
}

const referenceWidths: Record<LogColumn, readonly [number, number]> = {
  number: [44, 44],
  userName: [84, 118],
  studentNo: [98, 142],
  createdAt: [139, 187],
  status: [72, 98],
  bookTitle: [173, 276],
  author: [95, 163],
  totalReadPages: [70, 96],
};
export const LOG_MIN_WIDTH: Record<LogColumn, number> = {
  number: 44,
  userName: 62,
  studentNo: 84,
  createdAt: 76,
  status: 62,
  bookTitle: 86,
  author: 62,
  totalReadPages: 62,
};

export function logColumnWidths(
  columns: LogColumn[],
  viewport: number,
  custom: Partial<Record<LogColumn, number>>,
) {
  const widths = distributeWidths(columns, viewport - CHECK_WIDTH - DETAIL_WIDTH, referenceWidths);
  // Keep the left edge under the pointer. The next free column absorbs the
  // change until it reaches its compact width, then the table can scroll.
  let displacement = 0;
  for (const key of columns) {
    const base = widths[key];
    const width = custom[key] ?? Math.max(referenceWidths[key][0], base - displacement);
    widths[key] = width;
    displacement += width - base;
  }
  if (displacement < 0) {
    const neighbor = columns.findLast((key) => key !== 'number' && custom[key] == null);
    if (neighbor) widths[neighbor] -= displacement;
  }
  return widths;
}

const collator = new Intl.Collator('ko-KR', { numeric: true, sensitivity: 'base' });
function textValue(
  log: AdminReadingLogResponse,
  column: Exclude<LogSort['column'], 'totalReadPages'>,
) {
  switch (column) {
    case 'bookTitle':
    case 'author':
      return log.books[0]?.[column]?.trim() ?? '';
    case 'status':
      return READING_LOG_STATUS_LABELS[log.status];
    default:
      return log[column];
  }
}

export function visibleLogs(
  logs: AdminReadingLogResponse[],
  { query, from, to, course, sort }: LogSearch,
) {
  const keyword = query.trim().toLocaleLowerCase();
  const direction = sort.direction === 'ascending' ? 1 : -1;
  return logs
    .filter(
      (log) =>
        (!from || log.createdAt.slice(0, 10) >= from) &&
        (!to || log.createdAt.slice(0, 10) <= to) &&
        (!course || log.courseName === course) &&
        (!keyword ||
          [
            log.userName,
            log.studentNo,
            log.courseName,
            ...log.books.flatMap((book) => [
              book.bookTitle,
              book.author,
              book.publisher,
              book.isbn,
              book.callNo,
            ]),
          ].some((value) => value?.toLocaleLowerCase().includes(keyword))),
    )
    .sort((a, b) => {
      let comparison: number;
      if (sort.column === 'totalReadPages') {
        comparison = a.totalReadPages - b.totalReadPages;
      } else {
        const left = textValue(a, sort.column);
        const right = textValue(b, sort.column);
        if (Boolean(left) !== Boolean(right)) return left ? -1 : 1;
        comparison =
          sort.column === 'createdAt' ? left.localeCompare(right) : collator.compare(left, right);
      }
      return (
        direction * comparison ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.readingLogId - b.readingLogId
      );
    });
}
