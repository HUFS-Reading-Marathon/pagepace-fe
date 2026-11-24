import { REQUEST_STATUS_LABELS, type BookRequest } from '../../../api/bookRequestApi';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../table/pagination';

/** 상태 필터. 서버 상태값(PENDING·LINKED·REJECTED)을 그대로 쓰고, 전체만 더합니다. */
export type BookRequestFilter = BookRequest['status'] | 'ALL';
export type BookRequestSort = 'oldest' | 'newest';
export type BookRequestSearch = {
  filter: BookRequestFilter;
  query: string;
  sort: BookRequestSort;
};

export const BOOK_REQUEST_FILTER_LABELS: Record<BookRequestFilter, string> = {
  ...REQUEST_STATUS_LABELS,
  ALL: '전체',
};
export const BOOK_REQUEST_FILTERS = Object.keys(BOOK_REQUEST_FILTER_LABELS) as BookRequestFilter[];
export const INITIAL_BOOK_REQUEST_SEARCH: BookRequestSearch = {
  filter: 'PENDING',
  query: '',
  sort: 'oldest',
};

export function bookRequestCounts(rows: BookRequest[]) {
  const counts = { PENDING: 0, LINKED: 0, REJECTED: 0, ALL: rows.length };
  for (const row of rows) counts[row.status] += 1;
  return counts as Record<BookRequestFilter, number>;
}

/** ISBN은 하이픈·공백을 빼고 비교합니다. */
const compact = (value: string) => value.replace(/[\s-]/g, '').toLowerCase();

/**
 * 상태·검색어(이름, 학번·사번, 도서명, ISBN)로 거르고 요청일로 정렬합니다.
 * 요청 시각이 같으면 요청 번호로 순서를 고정합니다.
 */
export function visibleBookRequests(
  rows: BookRequest[],
  { filter, query, sort }: BookRequestSearch,
) {
  const keyword = query.trim().toLowerCase();
  const isbnKeyword = compact(query);
  const direction = sort === 'oldest' ? 1 : -1;
  return rows
    .filter((row) => filter === 'ALL' || row.status === filter)
    .filter(
      (row) =>
        !keyword ||
        [row.participantName, row.studentNo, row.title].some((value) =>
          (value ?? '').toLowerCase().includes(keyword),
        ) ||
        (!!isbnKeyword && compact(row.isbn ?? '').includes(isbnKeyword)),
    )
    .sort(
      (left, right) =>
        direction * (left.createdAt.localeCompare(right.createdAt) || left.id - right.id),
    );
}

/** 목록 상태. URL에 담아 상세에서 돌아오거나 새로고침해도 복원합니다. */
export type BookRequestListState = { search: BookRequestSearch; page: number; pageSize: number };

const LIST_KEYS = ['status', 'q', 'sort', 'page', 'size'];

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
      sort: params.get('sort') === 'newest' ? 'newest' : 'oldest',
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
  if (search.sort !== 'oldest') next.set('sort', search.sort);
  if (page > 0) next.set('page', String(page + 1));
  if (pageSize !== DEFAULT_PAGE_SIZE) next.set('size', String(pageSize));
  return next;
}

/** 상세 화면 요청 번호. 없으면 null, 형식이 잘못되면 NaN입니다. */
export function parseRequestId(value: string | null) {
  if (value === null) return null;
  return /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : Number.NaN;
}
