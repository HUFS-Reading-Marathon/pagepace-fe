import ContentSkeleton from '../../layout/ContentSkeleton';
import type { AdminReviewTarget } from '../../../api/adminReadingLogApi';
import { formatKoDateTime24 } from '../../../utils/date';
import SortHeaderButton from '../table/SortHeaderButton';
import TablePagination from '../table/TablePagination';
import {
  isDefaultReviewSort,
  REVIEW_FILTER_LABELS,
  REVIEW_SORT_COLUMNS,
  reviewDate,
  type ReviewFilter,
  type ReviewSearch,
  type ReviewSortColumn,
} from './reviewTargetFilters';
import '../../../styles/admin-participants.css';
import './review-target-table.css';

type Props = {
  rows: AdminReviewTarget[];
  total: number;
  page: number;
  pageSize: number;
  search: ReviewSearch;
  counts: Record<ReviewFilter, number>;
  /** 처음 불러오는 중이면 참 */
  loading: boolean;
  busy: boolean;
  /** 목록 조회 오류. 이미 받은 목록이 있으면 표를 그대로 두고 오류만 알립니다. */
  error: string;
  hasLoaded: boolean;
  feedback?: string;
  /** 상세에서 돌아왔을 때 표시할 행 */
  recent?: number | null;
  onSearch: (patch: Partial<ReviewSearch>) => void;
  /** 컬럼 제목을 눌러 정렬 (같은 컬럼을 다시 누르면 방향 전환) */
  onSort: (column: ReviewSortColumn) => void;
  onReset: () => void;
  onRefresh: () => void;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  onOpen: (target: AdminReviewTarget) => void;
};

const COLUMNS = [
  ['number', '순번', 56],
  ['userName', '이름', 100],
  ['studentNo', '학번·사번', 118],
  ['bookTitle', '도서명', 0],
  ['author', '저자', 140],
  ['pages', '승인 독서량', 96],
  ['date', '서평 시각', 150],
  ['status', '상태', 84],
  ['distance', '미인정 거리', 100],
  ['action', '확인', 92],
] as const;

/** 서평 개별 확인 대상 목록: 본문 전체 너비의 표, 상태·검색·정렬, 페이지 이동 */
export default function ReviewTargetTable({
  rows,
  total,
  page,
  pageSize,
  search,
  counts,
  loading,
  busy,
  error,
  hasLoaded,
  feedback,
  recent = null,
  onSearch,
  onSort,
  onReset,
  onRefresh,
  onPage,
  onPageSize,
  onOpen,
}: Props) {
  const start = page * pageSize;
  const searching = !!search.query.trim();
  const changed = searching || search.filter !== 'pending' || !isDefaultReviewSort(search.sort);
  const emptyText = loading
    ? '확인 대상을 불러오고 있습니다.'
    : error && !hasLoaded
      ? '서평 확인 대상을 불러오지 못했습니다.'
      : searching
        ? '조건에 맞는 서평이 없습니다.'
        : search.filter === 'pending'
          ? '확인 대기 중인 서평이 없습니다.'
          : search.filter === 'verified'
            ? '확인 완료된 서평이 없습니다.'
            : '서평 확인 대상이 없습니다.';
  return (
    <section className="review-targets roster-sheet" aria-label="서평 확인 대상 목록">
      {feedback && (
        <p className="roster-feedback" role="status">
          {feedback}
        </p>
      )}
      {error && (
        <div className="roster-error" role="alert">
          {error}
          {hasLoaded && ' 아래는 마지막으로 불러온 목록입니다.'}
          <button type="button" className="roster-link" disabled={busy} onClick={onRefresh}>
            다시 조회
          </button>
        </div>
      )}
      <div className="roster-tools">
        <div className="roster-actions" aria-live="polite">
          <strong id="review-target-count" tabIndex={-1}>
            {searching ? '검색 결과' : REVIEW_FILTER_LABELS[search.filter]}{' '}
            <b>{total.toLocaleString()}</b>건
          </strong>
        </div>
      </div>
      <div className="roster-filterline">
        <div className="roster-filters" role="search" aria-label="서평 확인 대상 검색 조건">
          <input
            type="search"
            aria-label="서평 확인 대상 검색"
            placeholder="이름, 학번, 도서명, 저자 검색"
            value={search.query}
            disabled={busy}
            onChange={(e) => onSearch({ query: e.target.value })}
          />
          <label>
            상태
            <select
              aria-label="확인 상태"
              value={search.filter}
              disabled={busy}
              onChange={(e) => onSearch({ filter: e.target.value as ReviewFilter })}
            >
              {(Object.keys(REVIEW_FILTER_LABELS) as ReviewFilter[]).map((filter) => (
                <option key={filter} value={filter}>
                  {REVIEW_FILTER_LABELS[filter]} ({counts[filter].toLocaleString()})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="roster-link"
            disabled={busy || !changed}
            onClick={onReset}
          >
            초기화
          </button>
          <button type="button" className="roster-link" disabled={busy} onClick={onRefresh}>
            새로고침
          </button>
        </div>
      </div>
      <div className="roster-scroll" tabIndex={0} role="region" aria-label="서평 확인 대상 표">
        <table className="roster-table review-targets__table" aria-busy={loading}>
          <caption className="sr-only">서평 확인 대상</caption>
          <colgroup>
            {COLUMNS.map(([key, , width]) => (
              <col key={key} style={width ? { width } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {COLUMNS.map(([key, label]) => {
                const sortable = key in REVIEW_SORT_COLUMNS;
                const direction =
                  sortable && search.sort.column === key ? search.sort.direction : undefined;
                return (
                  <th key={key} scope="col" data-column={key} aria-sort={direction}>
                    {sortable ? (
                      <SortHeaderButton
                        label={label}
                        direction={direction}
                        disabled={busy}
                        onSort={() => onSort(key as ReviewSortColumn)}
                      />
                    ) : (
                      label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading || !rows.length ? (
              <tr data-locked="">
                <td colSpan={COLUMNS.length} className="roster-empty">
                  {loading ? <ContentSkeleton variant="table" label={emptyText} /> : emptyText}
                </td>
              </tr>
            ) : (
              rows.map((target, i) => {
                const date = reviewDate(target);
                const number = start + i + 1;
                return (
                  <tr
                    key={target.participantBookId}
                    data-locked=""
                    data-recent={recent === target.participantBookId || undefined}
                  >
                    <td data-column="number">{number}</td>
                    <td data-column="userName" title={target.userName}>
                      {target.userName}
                    </td>
                    <td data-column="studentNo">{target.studentNo}</td>
                    <td data-column="bookTitle" title={target.bookTitle}>
                      {target.bookTitle}
                    </td>
                    <td data-column="author" title={target.author ?? undefined}>
                      {target.author || '—'}
                    </td>
                    <td data-column="pages">
                      {target.approvedReadPages.toLocaleString('ko-KR')}쪽
                    </td>
                    <td data-column="date">
                      {date ? (
                        <time
                          dateTime={date.at}
                          title={`서평 ${date.label} ${formatKoDateTime24(date.at)}`}
                        >
                          {date.label === '확인' && <small>확인 </small>}
                          {date.at.slice(0, 16).replace('T', ' ')}
                        </time>
                      ) : (
                        <span title="승인된 일지 · 참가자 알림 없음">알림 없음</span>
                      )}
                    </td>
                    <td data-column="status" data-verified={target.reviewVerified || undefined}>
                      {target.reviewVerified ? '확인 완료' : '확인 대기'}
                    </td>
                    <td data-column="distance">
                      {target.distanceToCreditMeter.toLocaleString('ko-KR')}m
                    </td>
                    <td data-column="action">
                      <button
                        type="button"
                        id={`review-target-row-${target.participantBookId}`}
                        className="review-targets__open"
                        aria-label={`${number}번 ${target.userName} ${target.bookTitle} 서평 ${target.reviewVerified ? '상세 보기' : '확인하기'}`}
                        disabled={busy}
                        onClick={() => onOpen(target)}
                      >
                        {target.reviewVerified ? '상세 보기' : '확인하기'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <TablePagination
        total={total}
        page={page}
        pageSize={pageSize}
        busy={busy}
        label="서평 확인 대상 페이지"
        onPage={onPage}
        onPageSize={onPageSize}
      />
    </section>
  );
}
