import type { AdminReadingLogStatus } from '../../../types/adminReadingLogApi';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../table/pagination';
import {
  DEFAULT_LOG_SORT,
  INITIAL_LOG_SEARCH,
  LOG_COLUMNS,
  type LogSearch,
  type LogSort,
} from './readingLogTable';

export type LogFilter = AdminReadingLogStatus | 'ALL';
export const LOG_FILTERS: LogFilter[] = ['SUBMITTED', 'APPROVED', 'REJECTED', 'ALL'];
export const DEFAULT_LOG_FILTER: LogFilter = 'SUBMITTED';

/** 목록 화면 상태. URL 검색 파라미터에 담아 상세 화면에서 돌아오거나 새로고침해도 그대로 복원합니다. */
export type LogListState = {
  status: LogFilter;
  search: LogSearch;
  /** 0부터 시작 (URL에는 1부터 씁니다) */
  page: number;
  pageSize: number;
};

const LIST_KEYS = ['status', 'q', 'from', 'to', 'course', 'sort', 'dir', 'page', 'size'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SORT_COLUMNS = Object.keys(LOG_COLUMNS).filter((key) => key !== 'number');

export function readLogListState(params: URLSearchParams): LogListState {
  const status = params.get('status') as LogFilter | null;
  const column = params.get('sort');
  const direction = params.get('dir') === 'desc' ? 'descending' : 'ascending';
  const sort: LogSort =
    column && SORT_COLUMNS.includes(column)
      ? { column: column as LogSort['column'], direction }
      : DEFAULT_LOG_SORT;
  const date = (key: string) => {
    const value = params.get(key) ?? '';
    return DATE.test(value) ? value : '';
  };
  const size = Number(params.get('size'));
  const page = Number(params.get('page'));
  return {
    status: status && LOG_FILTERS.includes(status) ? status : DEFAULT_LOG_FILTER,
    search: {
      ...INITIAL_LOG_SEARCH,
      query: params.get('q') ?? '',
      from: date('from'),
      to: date('to'),
      course: params.get('course') ?? '',
      sort,
    },
    page: Number.isInteger(page) && page > 1 ? page - 1 : 0,
    pageSize: (PAGE_SIZE_OPTIONS as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
  };
}

/**
 * 목록 상태를 URL 파라미터로 씁니다. 행사(eventId) 같은 다른 파라미터는 그대로 두고, 기본값은 생략합니다.
 * explicitStatus가 참이면 기본 상태(검토 대기)도 적어 둡니다. 상세 화면 URL은 이 값으로
 * "목록에서 들어온 상세"와 다른 화면의 바로가기(상태 없음)를 구분합니다.
 */
export function writeLogListState(
  base: URLSearchParams,
  state: LogListState,
  explicitStatus = false,
) {
  const next = new URLSearchParams(base);
  for (const key of LIST_KEYS) next.delete(key);
  const { status, search, page, pageSize } = state;
  if (explicitStatus || status !== DEFAULT_LOG_FILTER) next.set('status', status);
  if (search.query) next.set('q', search.query);
  if (search.from) next.set('from', search.from);
  if (search.to) next.set('to', search.to);
  if (search.course) next.set('course', search.course);
  if (
    search.sort.column !== DEFAULT_LOG_SORT.column ||
    search.sort.direction !== DEFAULT_LOG_SORT.direction
  ) {
    next.set('sort', search.sort.column);
    next.set('dir', search.sort.direction === 'descending' ? 'desc' : 'asc');
  }
  if (page > 0) next.set('page', String(page + 1));
  if (pageSize !== DEFAULT_PAGE_SIZE) next.set('size', String(pageSize));
  return next;
}

/** 상세 화면 URL: 목록 상태를 그대로 두고 일지 ID를 더합니다. */
export function logDetailParams(base: URLSearchParams, state: LogListState, logId: number) {
  const next = writeLogListState(base, state, true);
  next.set('logId', String(logId));
  return next;
}

/** 상세 화면에서 목록으로 돌아갈 URL 파라미터 */
export function logListParams(base: URLSearchParams) {
  const next = new URLSearchParams(base);
  next.delete('logId');
  if (next.get('status') === DEFAULT_LOG_FILTER) next.delete('status');
  return next;
}

/** 일지 ID 파라미터. 양의 정수가 아니면 잘못된 ID로 봅니다. */
export function parseLogId(value: string | null) {
  if (value === null) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : NaN;
}
