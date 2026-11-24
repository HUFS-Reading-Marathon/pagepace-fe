import { compareReviewTime, type AdminReviewTarget } from '../../../api/adminReadingLogApi';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../table/pagination';

/** 개별 확인 목록 상태 필터. 서버의 reviewVerified 값만 씁니다. */
export type ReviewFilter = 'pending' | 'verified' | 'all';
export type ReviewSort = 'oldest' | 'newest';
export type ReviewSearch = { filter: ReviewFilter; query: string; sort: ReviewSort };

export const REVIEW_FILTER_LABELS: Record<ReviewFilter, string> = {
  pending: '확인 대기',
  verified: '확인 완료',
  all: '전체',
};
export const INITIAL_REVIEW_SEARCH: ReviewSearch = { filter: 'pending', query: '', sort: 'oldest' };

export function reviewFilterCounts(targets: AdminReviewTarget[]) {
  const pending = targets.filter((target) => !target.reviewVerified).length;
  return { pending, verified: targets.length - pending, all: targets.length };
}

/**
 * 상태·검색어로 거르고 서평 제출 시각으로 정렬합니다. 제출 시각이 없는 솔라스 확인 건은 확인 시각을 쓰고,
 * 시각을 모르는 건은 정렬 방향과 관계없이 마지막에 둡니다(compareReviewTime).
 */
export function visibleReviewTargets(
  targets: AdminReviewTarget[],
  { filter, query, sort }: ReviewSearch,
) {
  const keyword = query.trim().toLowerCase();
  const direction = sort === 'oldest' ? 1 : -1;
  return targets
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
    )
    .sort((left, right) => compareReviewTime(left, right, direction));
}

/** 표에 쓰는 서평 시각: 제출 시각, 없으면 확인 시각, 둘 다 없으면 알림 없음 */
export function reviewDate(target: AdminReviewTarget) {
  if (target.reviewSubmittedAt) return { label: '제출', at: target.reviewSubmittedAt };
  if (target.reviewVerifiedAt) return { label: '확인', at: target.reviewVerifiedAt };
  return null;
}

/** 개별 확인 목록 상태. URL에 담아 상세에서 돌아오거나 새로고침해도 복원합니다. */
export type ReviewListState = { search: ReviewSearch; page: number; pageSize: number };

const REVIEW_LIST_KEYS = ['rf', 'rq', 'rsort', 'rpage', 'rsize'];
const REVIEW_FILTERS = Object.keys(REVIEW_FILTER_LABELS);

export function readReviewListState(params: URLSearchParams): ReviewListState {
  const filter = params.get('rf') ?? '';
  const size = Number(params.get('rsize'));
  const page = Number(params.get('rpage'));
  return {
    search: {
      filter: REVIEW_FILTERS.includes(filter) ? (filter as ReviewFilter) : 'pending',
      query: params.get('rq') ?? '',
      sort: params.get('rsort') === 'newest' ? 'newest' : 'oldest',
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
  if (search.sort !== 'oldest') next.set('rsort', search.sort);
  if (page > 0) next.set('rpage', String(page + 1));
  if (pageSize !== DEFAULT_PAGE_SIZE) next.set('rsize', String(pageSize));
  return next;
}
