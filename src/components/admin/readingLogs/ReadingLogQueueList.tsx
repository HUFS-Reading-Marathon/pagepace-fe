import { Fragment, type ReactNode } from 'react';
import type {
  AdminReadingLogResponse,
  AdminReadingLogStatus,
} from '../../../types/adminReadingLogApi';
import { READING_LOG_STATUS_LABELS } from '../../../types/readingLog';
import { formatKoDateTime24 } from '../../../utils/date';
import '../../../styles/admin-participants.css';
import './reading-log-queue.css';

type Filter = AdminReadingLogStatus | 'ALL';
const labels: Record<Filter, string> = { ...READING_LOG_STATUS_LABELS, ALL: '전체' };

type Props = {
  rows: AdminReadingLogResponse[];
  total: number;
  page: number;
  pageSize: number;
  filter: Filter;
  query: string;
  date: string;
  order: string;
  selected: number | null;
  selectedIds: ReadonlySet<number>;
  loading: boolean;
  processing: boolean;
  error: string;
  feedback: string;
  canSelect: (log: AdminReadingLogResponse) => boolean;
  onSelectionChange: (ids: Set<number>) => void;
  onApproveSelection: () => void;
  onFilter: (value: Filter) => void;
  onQuery: (value: string) => void;
  onDate: (value: string) => void;
  onOrder: (value: string) => void;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
  onSelect: (id: number | null) => void;
  onRetry?: () => void;
  renderDetail: (log: AdminReadingLogResponse) => ReactNode;
};

export default function ReadingLogQueueList({
  rows,
  total,
  page,
  pageSize,
  filter,
  query,
  date,
  order,
  selected,
  selectedIds,
  loading,
  processing,
  error,
  feedback,
  canSelect,
  onSelectionChange,
  onApproveSelection,
  onFilter,
  onQuery,
  onDate,
  onOrder,
  onPage,
  onPageSize,
  onSelect,
  onRetry,
  renderDetail,
}: Props) {
  const pageCount = Math.ceil(total / pageSize);
  const firstPage = Math.max(0, Math.min(page - 2, pageCount - 5));
  const pageNumbers = Array.from({ length: Math.min(5, pageCount) }, (_, i) => firstPage + i);
  const start = page * pageSize;
  const searching = !!(query.trim() || date);
  const showStatus = filter === 'ALL';
  const columnCount = showStatus ? 8 : 7;
  const selectable = rows.filter(canSelect).map((log) => log.readingLogId);
  const selectedCount = selectable.filter((id) => selectedIds.has(id)).length;
  const allChecked = selectable.length > 0 && selectedCount === selectable.length;
  const busy = processing || loading;
  function check(ids: number[], checked: boolean) {
    const next = new Set(selectedIds);
    for (const id of ids) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    onSelectionChange(next);
  }
  return (
    <section className="log-queue roster-sheet" aria-label="독서일지 목록">
      {feedback && (
        <p className="roster-feedback" role="status">
          {feedback}
        </p>
      )}
      {error && (
        <div className="roster-error" role="alert">
          {error}
          {onRetry && (
            <button type="button" className="roster-link" disabled={busy} onClick={onRetry}>
              다시 조회
            </button>
          )}
        </div>
      )}
      <div className="roster-tools">
        <div className="roster-actions" aria-live="polite">
          <strong id="log-review-count" className="log-queue__count" tabIndex={-1}>
            {searching ? '검색 결과' : labels[filter]} <b>{total.toLocaleString()}</b>건
          </strong>
          {selectedCount > 0 && (
            <span className="roster-selection">
              {selectedCount}건 선택{' '}
              <button
                type="button"
                className="roster-link"
                disabled={busy}
                onClick={() => onSelectionChange(new Set())}
              >
                선택 해제
              </button>
            </span>
          )}
        </div>
      </div>
      <div className="roster-filterline">
        <div
          className="roster-filters log-queue__filters"
          role="search"
          aria-label="독서일지 검색 조건"
        >
          <input
            type="search"
            aria-label="독서일지 검색"
            placeholder="이름, 학번, 도서명, 저자 검색"
            value={query}
            disabled={processing}
            onChange={(e) => onQuery(e.target.value)}
          />
          <label>
            상태
            <select
              aria-label="상태"
              value={filter}
              disabled={processing}
              onChange={(e) => onFilter(e.target.value as Filter)}
            >
              {(Object.keys(labels) as Filter[]).map((status) => (
                <option key={status} value={status}>
                  {labels[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            제출일
            <input
              type="date"
              aria-label="제출일"
              value={date}
              disabled={processing}
              onChange={(e) => onDate(e.target.value)}
            />
          </label>
          <label>
            정렬
            <select
              aria-label="정렬"
              value={order}
              disabled={processing}
              onChange={(e) => onOrder(e.target.value)}
            >
              <option value="oldest">제출 오래된 순</option>
              <option value="newest">최근 제출 순</option>
            </select>
          </label>
          <button
            type="button"
            className="roster-link"
            disabled={processing || (!searching && filter === 'SUBMITTED' && order === 'oldest')}
            onClick={() => {
              onQuery('');
              onDate('');
              onOrder('oldest');
              onFilter('SUBMITTED');
            }}
          >
            초기화
          </button>
        </div>
        <button
          type="button"
          className="roster-edit roster-btn"
          disabled={busy || !!error || !selectedCount}
          onClick={onApproveSelection}
        >
          선택 승인{selectedCount > 0 && ` (${selectedCount}건)`}
        </button>
      </div>
      <div className="roster-scroll" tabIndex={0} role="region" aria-label="독서일지 목록 표">
        <table className="roster-table log-queue__table" aria-busy={loading}>
          <caption className="sr-only">독서일지 목록</caption>
          <colgroup>
            <col className="log-col-check" />
            <col className="log-col-number" />
            <col className="log-col-name" />
            <col className="log-col-id" />
            <col className="log-col-date" />
            {showStatus && <col className="log-col-status" />}
            <col />
            <col className="log-col-pages" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="roster-check">
                <input
                  type="checkbox"
                  aria-label="이 페이지 승인 가능 일지 전체 선택"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = selectedCount > 0 && !allChecked;
                  }}
                  disabled={busy || !!error || !selectable.length}
                  onChange={(e) => check(selectable, e.target.checked)}
                />
              </th>
              <th scope="col" data-column="number">
                순번
              </th>
              <th scope="col">이름</th>
              <th scope="col">학번·사번</th>
              <th scope="col" aria-sort={order === 'oldest' ? 'ascending' : 'descending'}>
                <button
                  type="button"
                  className="roster-sort"
                  disabled={processing}
                  onClick={() => onOrder(order === 'oldest' ? 'newest' : 'oldest')}
                >
                  제출일
                  <span className="sort-mark" aria-hidden="true" />
                </button>
              </th>
              {showStatus && <th scope="col">상태</th>}
              <th scope="col">도서명</th>
              <th scope="col" className="log-queue__pages">
                쪽수
              </th>
            </tr>
          </thead>
          <tbody>
            {loading || !!error || !rows.length ? (
              <tr>
                <td colSpan={columnCount} className="roster-empty">
                  {loading
                    ? '일지를 불러오는 중입니다.'
                    : error
                      ? '독서일지를 불러오지 못했습니다.'
                      : searching
                        ? '조건에 맞는 일지가 없습니다.'
                        : filter === 'SUBMITTED'
                          ? '검토 대기 중인 일지가 없습니다.'
                          : '조회할 독서일지가 없습니다.'}
                </td>
              </tr>
            ) : (
              rows.map((log, i) => {
                const id = log.readingLogId;
                const open = selected === id;
                const submittedDate = log.createdAt.slice(0, 10);
                const book = log.books[0]?.bookTitle || '도서 미등록';
                const more = log.books.length > 1 ? ` 외 ${log.books.length - 1}권` : '';
                const detailId = `log-review-detail-${id}`;
                const eligible = canSelect(log);
                const checked = eligible && selectedIds.has(id);
                return (
                  <Fragment key={id}>
                    <tr
                      className="log-queue__row"
                      data-selected={checked || undefined}
                      data-open={open || undefined}
                    >
                      <td className="roster-check">
                        <input
                          type="checkbox"
                          aria-label={`${start + i + 1}번 ${log.userName} ${submittedDate} 제출 일지 선택, ${book}${more}`}
                          checked={checked}
                          disabled={busy || !eligible}
                          onChange={(e) => check([id], e.target.checked)}
                        />
                      </td>
                      <td data-column="number">
                        <span>{start + i + 1}</span>
                      </td>
                      <td className="log-cell-name">
                        <button
                          type="button"
                          id={`log-review-row-${id}`}
                          className="roster-name log-queue__toggle"
                          title={log.userName}
                          aria-label={`${log.userName} ${submittedDate} 제출 일지, ${book}${more}`}
                          aria-expanded={open}
                          aria-controls={open ? detailId : undefined}
                          disabled={processing}
                          onClick={() => onSelect(open ? null : id)}
                        >
                          {log.userName}
                        </button>
                      </td>
                      <td className="log-cell-id" title={log.studentNo}>
                        {log.studentNo || '—'}
                      </td>
                      <td
                        className="log-cell-submitted"
                        data-column="registeredAt"
                        title={formatKoDateTime24(log.createdAt)}
                      >
                        <time dateTime={log.createdAt}>{submittedDate}</time>
                      </td>
                      {showStatus && (
                        <td className="log-cell-status" data-status={log.status}>
                          {labels[log.status]}
                        </td>
                      )}
                      <td title={book + more} className="log-cell-book">
                        <span className="log-book-summary">
                          <span>{book}</span>
                          {more && <small>{more}</small>}
                        </span>
                      </td>
                      <td className="log-queue__pages">{log.totalReadPages.toLocaleString()}쪽</td>
                    </tr>
                    {open && (
                      <tr className="log-queue__detail-row">
                        <td colSpan={columnCount} className="log-queue__detail" id={detailId}>
                          <div className="log-queue__detail-content">{renderDetail(log)}</div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <footer className="roster-footer">
        <span aria-live="polite">
          {total
            ? `${(start + 1).toLocaleString()}–${Math.min(total, start + pageSize).toLocaleString()}`
            : '0'}{' '}
          / {total.toLocaleString()}건
        </span>
        <nav className="roster-pagination" aria-label="일지 페이지">
          <button
            type="button"
            aria-label="이전 페이지"
            disabled={!page || busy}
            onClick={() => onPage(page - 1)}
          >
            이전
          </button>
          {pageNumbers.map((n) => (
            <button
              type="button"
              key={n}
              aria-label={`${n + 1}페이지`}
              aria-current={n === page ? 'page' : undefined}
              disabled={busy}
              onClick={() => onPage(n)}
            >
              {n + 1}
            </button>
          ))}
          <button
            type="button"
            aria-label="다음 페이지"
            disabled={page + 1 >= pageCount || busy}
            onClick={() => onPage(page + 1)}
          >
            다음
          </button>
        </nav>
        {onPageSize && (
          <select
            aria-label="페이지당 행 수"
            value={pageSize}
            disabled={busy}
            onChange={(e) => onPageSize(Number(e.target.value))}
          >
            {[10, 25, 50].map((size) => (
              <option key={size} value={size}>
                {size}건씩 보기
              </option>
            ))}
          </select>
        )}
      </footer>
    </section>
  );
}
