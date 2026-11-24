import { REQUEST_STATUS_LABELS, type BookRequest } from '../../../api/bookRequestApi';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../table/pagination';
import {
  directionParam,
  orderValue,
  readDirection,
  sortRows,
  timeValue,
  type SortState,
} from '../table/sorting';

/** 상태 필터. 서버 상태값(PENDING·LINKED·REJECTED)을 그대로 쓰고, 전체만 더합니다. */
export type BookRequestFilter = BookRequest['status'] | 'ALL';
/** 정렬할 수 있는 컬럼(순번·검토 버튼 제외) */
export const BOOK_REQUEST_SORT_COLUMNS = {
  participantName: '참가자',
  studentNo: '학번·사번',
  title: '요청 도서명',
  author: '저자',
  readPages: '요청 독서량',
  createdAt: '요청일',
  status: '상태',
} as const;
export type BookRequestSortColumn = keyof typeof BOOK_REQUEST_SORT_COLUMNS;
export type BookRequestSort = SortState<BookRequestSortColumn>;
export type BookRequestSearch = {
  filter: BookRequestFilter;
  query: string;
  sort: BookRequestSort;
};
/** 기본: 요청 오래된 순 */
export const DEFAULT_BOOK_REQUEST_SORT: BookRequestSort = {
  column: 'createdAt',
  direction: 'ascending',
};

export const BOOK_REQUEST_FILTER_LABELS: Record<BookRequestFilter, string> = {
  ...REQUEST_STATUS_LABELS,
  ALL: '전체',
};
export const BOOK_REQUEST_FILTERS = Object.keys(BOOK_REQUEST_FILTER_LABELS) as BookRequestFilter[];
export const INITIAL_BOOK_REQUEST_SEARCH: BookRequestSearch = {
  filter: 'PENDING',
  query: '',
  sort: DEFAULT_BOOK_REQUEST_SORT,
};

/** 상태는 업무 순서(확인 대기 → 일지 심사로 이관 → 반려)로 정렬합니다. */
const STATUS_ORDER: BookRequest['status'][] = ['PENDING', 'LINKED', 'REJECTED'];

function sortValue(row: BookRequest, column: BookRequestSortColumn) {
  switch (column) {
    case 'readPages':
      return row.readPages;
    case 'createdAt':
      return timeValue(row.createdAt);
    case 'status':
      return orderValue(STATUS_ORDER, row.status);
    default:
      return row[column]?.trim() ?? '';
  }
}

export function isDefaultBookRequestSort(sort: BookRequestSort) {
  return (
    sort.column === DEFAULT_BOOK_REQUEST_SORT.column &&
    sort.direction === DEFAULT_BOOK_REQUEST_SORT.direction
  );
}

export function bookRequestCounts(rows: BookRequest[]) {
  const counts = { PENDING: 0, LINKED: 0, REJECTED: 0, ALL: rows.length };
  for (const row of rows) counts[row.status] += 1;
  return counts as Record<BookRequestFilter, number>;
}

/** ISBN은 하이픈·공백을 빼고 비교합니다. */
const compact = (value: string) => value.replace(/[\s-]/g, '').toLowerCase();

/**
 * 상태·검색어(이름, 학번·사번, 도서명, ISBN)로 거른 전체 목록을 선택한 컬럼으로 정렬합니다(페이지 나누기 전).
 * 값이 같으면 요청 시각, 그다음 요청 번호로 순서를 고정합니다.
 */
export function visibleBookRequests(
  rows: BookRequest[],
  { filter, query, sort }: BookRequestSearch,
) {
  const keyword = query.trim().toLowerCase();
  const isbnKeyword = compact(query);
  return sortRows(
    rows
      .filter((row) => filter === 'ALL' || row.status === filter)
      .filter(
        (row) =>
          !keyword ||
          [row.participantName, row.studentNo, row.title].some((value) =>
            (value ?? '').toLowerCase().includes(keyword),
          ) ||
          (!!isbnKeyword && compact(row.isbn ?? '').includes(isbnKeyword)),
      ),
    sort,
    sortValue,
    (left, right) => left.createdAt.localeCompare(right.createdAt) || left.id - right.id,
  );
}

/** 목록 상태. URL에 담아 상세에서 돌아오거나 새로고침해도 복원합니다. */
export type BookRequestListState = { search: BookRequestSearch; page: number; pageSize: number };

const LIST_KEYS = ['status', 'q', 'sort', 'dir', 'page', 'size'];

/** 정렬 URL: sort=컬럼&dir=asc|desc. 이전 주소의 sort=newest(최근 요청 순)도 그대로 엽니다. */
function readSort(params: URLSearchParams): BookRequestSort {
  const column = params.get('sort') ?? '';
  if (column === 'newest') return { column: 'createdAt', direction: 'descending' };
  return column in BOOK_REQUEST_SORT_COLUMNS
    ? { column: column as BookRequestSortColumn, direction: readDirection(params.get('dir')) }
    : DEFAULT_BOOK_REQUEST_SORT;
}

export function readBookRequestListState(params: URLSearchParams): BookRequestListState {
  const filter = params.get('status') ?? '';
  const size = Number(params.get('size'));
  const page = Number(params.get('page'));
  return {
    search: {
      filter: (BOOK_REQUEST_FILTERS as string[]).includes(filter)
        ? (filter as BookRequestFilter)
        : 'PENDING',
      query: params.get('q') ?? '',
      sort: readSort(params),
    },
    page: Number.isInteger(page) && page > 1 ? page - 1 : 0,
    pageSize: (PAGE_SIZE_OPTIONS as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
  };
}

/** 목록 상태를 URL에 씁니다. 행사·상세 같은 다른 파라미터는 그대로 두고 기본값은 생략합니다. */
export function writeBookRequestListState(
  base: URLSearchParams,
  { search, page, pageSize }: BookRequestListState,
) {
  const next = new URLSearchParams(base);
  for (const key of LIST_KEYS) next.delete(key);
  if (search.filter !== 'PENDING') next.set('status', search.filter);
  if (search.query) next.set('q', search.query);
  if (!isDefaultBookRequestSort(search.sort)) {
    next.set('sort', search.sort.column);
    next.set('dir', directionParam(search.sort.direction));
  }
  if (page > 0) next.set('page', String(page + 1));
  if (pageSize !== DEFAULT_PAGE_SIZE) next.set('size', String(pageSize));
  return next;
}

/** 상세 화면 요청 번호. 없으면 null, 형식이 잘못되면 NaN입니다. */
export function parseRequestId(value: string | null) {
  if (value === null) return null;
  return /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : Number.NaN;
}
