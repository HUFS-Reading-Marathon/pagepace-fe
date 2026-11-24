import { compareReviewTime, type AdminReviewTarget } from '../../../api/adminReadingLogApi';

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
