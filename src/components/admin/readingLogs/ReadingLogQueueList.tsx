import type {
  AdminReadingLogResponse,
  AdminReadingLogStatus,
} from '../../../types/adminReadingLogApi';
import { READING_LOG_STATUS_LABELS } from '../../../types/readingLog';
import { formatKoDateTime24 } from '../../../utils/date';
import ColumnResizeHandle from '../table/ColumnResizeHandle';
import TablePagination from '../table/TablePagination';
import { CHECK_WIDTH, useColumnSizing } from '../table/tableColumns';
import { useTableCellText } from '../table/useTableCellText';
import {
  DEFAULT_LOG_SORT,
  DETAIL_WIDTH,
  LOG_COLUMNS,
  LOG_MIN_WIDTH,
  logColumnWidths,
  visibleLogColumns,
  type LogColumn,
  type LogSort,
} from './readingLogTable';
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
  from: string;
  to: string;
  course: string;
  /** 코스 필터 선택지. 비어 있으면 코스 필터를 숨깁니다. */
  courseOptions?: string[];
  sort: LogSort;
  /** 상세 화면에서 돌아왔을 때 표시할 행 */
  recent?: number | null;
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
  onDates: (patch: { from?: string; to?: string }) => void;
  onCourse?: (value: string) => void;
  onSort: (key: LogSort['column']) => void;
  onReset: () => void;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
  /** 일지 상세 검토 화면을 엽니다. */
  onOpen: (id: number) => void;
  onRetry?: () => void;
  /** 현재 조건으로 서버 목록을 다시 불러옵니다. */
  onRefresh?: () => void;
};

export default function ReadingLogQueueList({
  rows,
  total,
  page,
  pageSize,
  filter,
  query,
  from,
  to,
  course,
  courseOptions = [],
  sort,
  recent = null,
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
  onDates,
  onCourse,
  onSort,
  onReset,
  onPage,
  onPageSize,
  onOpen,
  onRetry,
  onRefresh,
}: Props) {
  const start = page * pageSize;
  const searching = !!(query.trim() || from || to || course);
  const showStatus = filter === 'ALL';
  const columns = visibleLogColumns(showStatus);
  const columnCount = columns.length + 2;
  const { container, viewport, custom, resize, resetWidth } = useColumnSizing<LogColumn>();
  const widths = logColumnWidths(columns, viewport, custom);
  const tableWidth =
    CHECK_WIDTH + DETAIL_WIDTH + columns.reduce((sum, key) => sum + widths[key], 0);
  const { table, fitText } = useTableCellText(
    rows.length > 0 && !loading && !error,
    showStatus ? 'all' : 'filtered',
  );
  const defaultSort =
    sort.column === DEFAULT_LOG_SORT.column && sort.direction === DEFAULT_LOG_SORT.direction;
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
          {onCourse && courseOptions.length > 1 && (
            <label>
              코스
              <select
                aria-label="코스"
                value={course}
                disabled={processing}
                onChange={(e) => onCourse(e.target.value)}
              >
                <option value="">전체 코스</option>
                {courseOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <fieldset className="log-queue__dates">
            <legend>제출 기간</legend>
            <input
              type="date"
              aria-label="제출 기간 시작일"
              value={from}
              max={to || undefined}
              disabled={processing}
              onChange={(e) => onDates({ from: e.target.value })}
            />
            <span aria-hidden="true">~</span>
            <input
              type="date"
              aria-label="제출 기간 종료일"
              value={to}
              min={from || undefined}
              disabled={processing}
              onChange={(e) => onDates({ to: e.target.value })}
            />
          </fieldset>
          <button
            type="button"
            className="roster-link"
            disabled={processing || (!searching && filter === 'SUBMITTED' && defaultSort)}
            onClick={onReset}
          >
            초기화
          </button>
          {onRefresh && (
            <button type="button" className="roster-link" disabled={busy} onClick={onRefresh}>
              새로고침
            </button>
          )}
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
      <div
        ref={container}
        className="roster-scroll"
        tabIndex={0}
        role="region"
        aria-label="독서일지 목록 표"
      >
        <table
          ref={table}
          style={{ width: tableWidth }}
          className="roster-table log-queue__table"
          aria-busy={loading}
        >
          <caption className="sr-only">독서일지 목록</caption>
          <colgroup>
            <col style={{ width: CHECK_WIDTH }} />
            {columns.map((key) => (
              <col key={key} style={{ width: widths[key] }} />
            ))}
            <col style={{ width: DETAIL_WIDTH }} />
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
              {columns.map((key) => {
                const direction = sort.column === key ? sort.direction : undefined;
                return (
                  <th key={key} scope="col" data-column={key} aria-sort={direction}>
                    {key === 'number' ? (
                      LOG_COLUMNS[key]
                    ) : (
                      <button
                        type="button"
                        className="roster-sort"
                        disabled={processing}
                        title={
                          LOG_COLUMNS[key] +
                          (direction === 'ascending' ? ' 내림차순 정렬' : ' 오름차순 정렬')
                        }
                        onClick={() => onSort(key)}
                      >
                        {LOG_COLUMNS[key]}
                        <span className="sort-mark" aria-hidden="true" />
                      </button>
                    )}
                    <ColumnResizeHandle
                      label={LOG_COLUMNS[key]}
                      width={widths[key]}
                      minWidth={LOG_MIN_WIDTH[key]}
                      onChange={(width) => resize(key, width)}
                      onReset={() => resetWidth(key)}
                    />
                  </th>
                );
              })}
              <th scope="col" className="log-queue__disclosure">
                검토
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
                const submittedDate = log.createdAt.slice(0, 10);
                const book = log.books[0]?.bookTitle || '도서 미등록';
                const more = log.books.length > 1 ? ` 외 ${log.books.length - 1}권` : '';
                const values: Record<LogColumn, string> = {
                  number: String(start + i + 1),
                  userName: log.userName,
                  studentNo: log.studentNo,
                  createdAt: submittedDate + ' ' + log.createdAt.slice(11, 16),
                  status: labels[log.status],
                  bookTitle: book + more,
                  author: log.books[0]?.author || '',
                  totalReadPages: log.totalReadPages.toLocaleString() + '쪽',
                };
                const eligible = canSelect(log);
                const checked = eligible && selectedIds.has(id);
                return (
                  <tr
                    key={id}
                    className="log-queue__row"
                    data-selected={checked || undefined}
                    data-recent={recent === id || undefined}
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
                    {columns.map((key) => {
                      const value = values[key];
                      const display = fitText ? fitText(key, value, widths[key]) : value;
                      return (
                        <td
                          key={key}
                          data-column={key}
                          data-status={key === 'status' ? log.status : undefined}
                          title={
                            key === 'createdAt'
                              ? formatKoDateTime24(log.createdAt)
                              : value || undefined
                          }
                          aria-label={display !== value ? value : undefined}
                        >
                          {key === 'createdAt' ? (
                            <time dateTime={log.createdAt}>{display}</time>
                          ) : (
                            <span>{display || '—'}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="log-queue__disclosure">
                      <button
                        type="button"
                        id={`log-review-row-${id}`}
                        className="log-queue__open"
                        aria-label={`${start + i + 1}번 ${log.userName} 일지 ${log.status === 'SUBMITTED' ? '검토하기' : '상세 보기'}`}
                        disabled={processing}
                        onClick={() => onOpen(id)}
                      >
                        {log.status === 'SUBMITTED' ? '검토하기' : '상세 보기'}
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
        label="일지 페이지"
        onPage={onPage}
        onPageSize={onPageSize}
      />
    </section>
  );
}
