import type { BookRequest } from '../../../api/bookRequestApi';
import { formatKoDateTime24 } from '../../../utils/date';
import SortHeaderButton from '../table/SortHeaderButton';
import TablePagination from '../table/TablePagination';
import {
  BOOK_REQUEST_FILTER_LABELS,
  BOOK_REQUEST_FILTERS,
  BOOK_REQUEST_SORT_COLUMNS,
  INITIAL_BOOK_REQUEST_SEARCH,
  isDefaultBookRequestSort,
  type BookRequestFilter,
  type BookRequestSearch,
  type BookRequestSortColumn,
} from './bookRequestList';
import '../../../styles/admin-participants.css';
import './book-request-admin.css';

type Props = {
  rows: BookRequest[];
  total: number;
  page: number;
  pageSize: number;
  search: BookRequestSearch;
  counts: Record<BookRequestFilter, number>;
  /** 처음 불러오는 중이면 참 */
  loading: boolean;
  busy: boolean;
  /** 목록 조회 오류. 이미 받은 목록이 있으면 표를 그대로 두고 오류만 알립니다. */
  error: string;
  hasLoaded: boolean;
  feedback?: string;
  /** 상세에서 돌아왔을 때 표시할 행 */
  recent?: number | null;
  onSearch: (patch: Partial<BookRequestSearch>) => void;
  /** 컬럼 제목을 눌러 정렬 (같은 컬럼을 다시 누르면 방향 전환) */
  onSort: (column: BookRequestSortColumn) => void;
  onReset: () => void;
  onRefresh: () => void;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  onOpen: (row: BookRequest) => void;
};

const COLUMNS = [
  ['number', '순번', 56],
  ['participantName', '참가자', 100],
  ['studentNo', '학번·사번', 112],
  ['title', '요청 도서명', 0],
  ['author', '저자', 130],
  ['readPages', '요청 독서량', 92],
  ['createdAt', '요청일', 140],
  ['status', '상태', 116],
  ['action', '검토', 92],
] as const;

/** 도서 확인 요청 목록: 본문 전체 너비의 표, 상태·검색·정렬, 페이지 이동 */
export default function BookRequestTable({
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
  const changed =
    searching ||
    search.filter !== INITIAL_BOOK_REQUEST_SEARCH.filter ||
    !isDefaultBookRequestSort(search.sort);
  const emptyText = loading
    ? '도서 확인 요청을 불러오고 있습니다.'
    : error && !hasLoaded
      ? '도서 확인 요청을 불러오지 못했습니다.'
      : searching
        ? '조건에 맞는 요청이 없습니다.'
        : search.filter === 'PENDING'
          ? '확인 대기 중인 요청이 없습니다.'
          : search.filter === 'ALL'
            ? '도서 확인 요청이 없습니다.'
            : `${BOOK_REQUEST_FILTER_LABELS[search.filter]} 요청이 없습니다.`;
  return (
    <section className="book-request-list roster-sheet" aria-label="도서 확인 요청 목록">
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
          <strong id="book-request-count" tabIndex={-1}>
            {searching ? '검색 결과' : BOOK_REQUEST_FILTER_LABELS[search.filter]}{' '}
            <b>{total.toLocaleString()}</b>건
          </strong>
        </div>
      </div>
      <div className="roster-filterline">
        <div className="roster-filters" role="search" aria-label="도서 확인 요청 검색 조건">
          <input
            type="search"
            aria-label="도서 확인 요청 검색"
            placeholder="이름, 학번, 도서명, ISBN 검색"
            value={search.query}
            disabled={busy}
            onChange={(e) => onSearch({ query: e.target.value })}
          />
          <label>
            상태
            <select
              aria-label="요청 상태"
              value={search.filter}
              disabled={busy}
              onChange={(e) => onSearch({ filter: e.target.value as BookRequestFilter })}
            >
              {BOOK_REQUEST_FILTERS.map((filter) => (
                <option key={filter} value={filter}>
                  {BOOK_REQUEST_FILTER_LABELS[filter]} ({counts[filter].toLocaleString()})
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
      <div className="roster-scroll" tabIndex={0} role="region" aria-label="도서 확인 요청 표">
        <table className="roster-table book-request-list__table" aria-busy={loading}>
          <caption className="sr-only">도서 확인 요청</caption>
          <colgroup>
            {COLUMNS.map(([key, , width]) => (
              <col key={key} style={width ? { width } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {COLUMNS.map(([key, label]) => {
                const sortable = key in BOOK_REQUEST_SORT_COLUMNS;
                const direction =
                  sortable && search.sort.column === key ? search.sort.direction : undefined;
                return (
                  <th key={key} scope="col" data-column={key} aria-sort={direction}>
                    {sortable ? (
                      <SortHeaderButton
                        label={label}
                        direction={direction}
                        disabled={busy}
                        onSort={() => onSort(key as BookRequestSortColumn)}
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
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const number = start + i + 1;
                const pending = row.status === 'PENDING';
                const action = pending ? '검토하기' : '상세 보기';
                return (
                  <tr key={row.id} data-locked="" data-recent={recent === row.id || undefined}>
                    <td data-column="number">{number}</td>
                    <td data-column="participantName" title={row.participantName}>
                      {row.participantName}
                    </td>
                    <td data-column="studentNo">{row.studentNo}</td>
                    <td data-column="title" title={row.title}>
                      {row.title}
                    </td>
                    <td data-column="author" title={row.author || undefined}>
                      {row.author || '—'}
                    </td>
                    <td data-column="readPages">{row.readPages.toLocaleString('ko-KR')}쪽</td>
                    <td data-column="createdAt">
                      <time dateTime={row.createdAt} title={formatKoDateTime24(row.createdAt)}>
                        {row.createdAt.slice(0, 16).replace('T', ' ')}
                      </time>
                    </td>
                    <td data-column="status" data-status={row.status}>
                      {BOOK_REQUEST_FILTER_LABELS[row.status]}
                    </td>
                    <td data-column="action">
                      <button
                        type="button"
                        id={`book-request-row-${row.id}`}
                        className="book-request-list__open"
                        aria-label={`${number}번 ${row.participantName} ${row.title} 요청 ${action}`}
                        disabled={busy}
                        onClick={() => onOpen(row)}
                      >
                        {action}
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
        label="도서 확인 요청 페이지"
        onPage={onPage}
        onPageSize={onPageSize}
      />
    </section>
  );
}
