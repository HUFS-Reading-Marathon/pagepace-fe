import { compareReviewTime, type AdminReviewTarget } from '../../../api/adminReadingLogApi';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../table/pagination';
import {
  directionParam,
  readDirection,
  sortRows,
  timeValue,
  type SortState,
} from '../table/sorting';

/** 개별 확인 목록 상태 필터. 서버의 reviewVerified 값만 씁니다. */
export type ReviewFilter = 'pending' | 'verified' | 'all';
/** 정렬할 수 있는 컬럼(순번·확인 버튼 제외) */
export const REVIEW_SORT_COLUMNS = {
  userName: '이름',
  studentNo: '학번·사번',
  bookTitle: '도서명',
  author: '저자',
  pages: '승인 독서량',
  date: '서평 시각',
  status: '상태',
  distance: '미인정 거리',
} as const;
export type ReviewSortColumn = keyof typeof REVIEW_SORT_COLUMNS;
export type ReviewSort = SortState<ReviewSortColumn>;
export type ReviewSearch = { filter: ReviewFilter; query: string; sort: ReviewSort };
/** 기본: 서평 시각 오래된 순(제출 시각, 없으면 확인 시각. 시각을 모르는 대상은 마지막) */
export const DEFAULT_REVIEW_SORT: ReviewSort = { column: 'date', direction: 'ascending' };
export const isDefaultReviewSort = (sort: ReviewSort) =>
  sort.column === DEFAULT_REVIEW_SORT.column && sort.direction === DEFAULT_REVIEW_SORT.direction;

function reviewSortValue(target: AdminReviewTarget, column: ReviewSortColumn) {
  switch (column) {
    case 'pages':
      return target.approvedReadPages;
    case 'distance':
      return target.distanceToCreditMeter;
    case 'date':
      return timeValue(target.reviewSubmittedAt ?? target.reviewVerifiedAt);
    case 'status':
      // 확인 대기 → 확인 완료
      return target.reviewVerified ? 1 : 0;
    default:
      return target[column]?.trim() ?? '';
  }
}

export const REVIEW_FILTER_LABELS: Record<ReviewFilter, string> = {
  pending: '확인 대기',
  verified: '확인 완료',
  all: '전체',
};
export const INITIAL_REVIEW_SEARCH: ReviewSearch = {
  filter: 'pending',
  query: '',
  sort: DEFAULT_REVIEW_SORT,
};

export function reviewFilterCounts(targets: AdminReviewTarget[]) {
  const pending = targets.filter((target) => !target.reviewVerified).length;
  return { pending, verified: targets.length - pending, all: targets.length };
}

/**
 * 상태·검색어로 거른 전체 대상을 선택한 컬럼으로 정렬합니다(페이지 나누기 전). 서평 시각은 제출 시각,
 * 없으면 확인 시각을 쓰고, 값을 모르는 대상은 정렬 방향과 관계없이 마지막에 둡니다.
 * 값이 같으면 서평 시각 순(compareReviewTime), 그다음 참가 도서 번호로 순서를 고정합니다.
 */
export function visibleReviewTargets(
  targets: AdminReviewTarget[],
  { filter, query, sort }: ReviewSearch,
) {
  const keyword = query.trim().toLowerCase();
  const filtered = targets
    .filter((target) =>
      filter === 'all'
        ? true
        : filter === 'pending'
          ? !target.reviewVerified
          : target.reviewVerified,
    )
    .filter(
      (target) =>
        !keyword ||
        [target.userName, target.studentNo, target.bookTitle, target.author ?? ''].some((value) =>
          value.toLowerCase().includes(keyword),
        ),
    );
  return sortRows(filtered, sort, reviewSortValue, (left, right) => compareReviewTime(left, right));
}

/** 표에 쓰는 서평 시각: 제출 시각, 없으면 확인 시각, 둘 다 없으면 알림 없음 */
export function reviewDate(target: AdminReviewTarget) {
  if (target.reviewSubmittedAt) return { label: '제출', at: target.reviewSubmittedAt };
  if (target.reviewVerifiedAt) return { label: '확인', at: target.reviewVerifiedAt };
  return null;
}

/** 개별 확인 목록 상태. URL에 담아 상세에서 돌아오거나 새로고침해도 복원합니다. */
export type ReviewListState = { search: ReviewSearch; page: number; pageSize: number };

const REVIEW_LIST_KEYS = ['rf', 'rq', 'rsort', 'rdir', 'rpage', 'rsize'];

/** 정렬 URL: rsort=컬럼&rdir=asc|desc. 이전 주소의 rsort=newest(최근 제출 순)도 그대로 엽니다. */
function readReviewSort(params: URLSearchParams): ReviewSort {
  const column = params.get('rsort') ?? '';
  if (column === 'newest') return { column: 'date', direction: 'descending' };
  return column in REVIEW_SORT_COLUMNS
    ? { column: column as ReviewSortColumn, direction: readDirection(params.get('rdir')) }
    : DEFAULT_REVIEW_SORT;
}
const REVIEW_FILTERS = Object.keys(REVIEW_FILTER_LABELS);

export function readReviewListState(params: URLSearchParams): ReviewListState {
  const filter = params.get('rf') ?? '';
  const size = Number(params.get('rsize'));
  const page = Number(params.get('rpage'));
  return {
    search: {
      filter: REVIEW_FILTERS.includes(filter) ? (filter as ReviewFilter) : 'pending',
      query: params.get('rq') ?? '',
      sort: readReviewSort(params),
    },
    page: Number.isInteger(page) && page > 1 ? page - 1 : 0,
    pageSize: (PAGE_SIZE_OPTIONS as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
  };
}

/** 목록 상태를 URL에 씁니다. 행사·탭 같은 다른 파라미터는 그대로 두고 기본값은 생략합니다. */
export function writeReviewListState(
  base: URLSearchParams,
  { search, page, pageSize }: ReviewListState,
) {
  const next = new URLSearchParams(base);
  for (const key of REVIEW_LIST_KEYS) next.delete(key);
  if (search.filter !== 'pending') next.set('rf', search.filter);
  if (search.query) next.set('rq', search.query);
  if (!isDefaultReviewSort(search.sort)) {
    next.set('rsort', search.sort.column);
    next.set('rdir', directionParam(search.sort.direction));
  }
  if (page > 0) next.set('rpage', String(page + 1));
  if (pageSize !== DEFAULT_PAGE_SIZE) next.set('rsize', String(pageSize));
  return next;
}
