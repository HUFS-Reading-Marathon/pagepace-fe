import { Fragment, type ReactNode } from 'react';
import type {
  AdminReadingLogResponse,
  AdminReadingLogStatus,
} from '../../../types/adminReadingLogApi';
import { READING_LOG_STATUS_LABELS } from '../../../types/readingLog';
import { formatKoDate, formatKoDateKey, formatKoDateTime24 } from '../../../utils/date';
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
  loading: boolean;
  processing: boolean;
  error: string;
  feedback: string;
  onFilter: (value: Filter) => void;
  onQuery: (value: string) => void;
  onDate: (value: string) => void;
  onOrder: (value: string) => void;
  onPage: (page: number) => void;
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
  loading,
  processing,
  error,
  feedback,
  onFilter,
  onQuery,
  onDate,
  onOrder,
  onPage,
  onSelect,
  onRetry,
  renderDetail,
}: Props) {
  const pageCount = Math.ceil(total / pageSize);
  const firstPage = Math.max(0, Math.min(page - 2, pageCount - 5));
  const pageNumbers = Array.from({ length: Math.min(5, pageCount) }, (_, i) => firstPage + i);
  const searching = !!(query.trim() || date);
  const reset = () => {
    onQuery('');
    onDate('');
    onOrder('oldest');
    onFilter('SUBMITTED');
  };
  return (
    <section className="log-queue" aria-label="독서일지 목록">
      <div className="log-queue__filters" role="search" aria-label="독서일지 검색 조건">
        <input
          type="search"
          aria-label="독서일지 검색"
          placeholder="이름, 학번, 책 제목, 저자, 출판사"
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
          독서일
          <input
            type="date"
            aria-label="독서 날짜"
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
        {(searching || filter !== 'SUBMITTED' || order !== 'oldest') && (
          <button type="button" className="log-queue__reset" disabled={processing} onClick={reset}>
            초기화
          </button>
        )}
      </div>
      {feedback && (
        <p className="log-queue__feedback" role="status">
          {feedback}
        </p>
      )}
      {error ? (
        <div className="log-queue__message" role="alert">
          {error}{' '}
          {onRetry && (
            <button type="button" disabled={processing || loading} onClick={onRetry}>
              다시 조회
            </button>
          )}
        </div>
      ) : loading ? (
        <p className="log-queue__message" role="status">
          일지를 불러오는 중입니다.
        </p>
      ) : (
        <>
          <h2 id="log-review-count" className="log-queue__count" tabIndex={-1}>
            {searching ? '검색 결과' : labels[filter]} <b>{total.toLocaleString()}</b>건
          </h2>
          <table className="log-queue__table">
            <caption className="sr-only">독서일지 목록</caption>
            <colgroup>
              <col />
              <col className="log-col-name" />
              <col className="log-col-id" />
              <col className="log-col-date" span={2} />
              <col className="log-col-pages" />
              <col className="log-col-status" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">도서명</th>
                <th scope="col">참가자</th>
                <th scope="col">학번·사번</th>
                <th scope="col">독서일</th>
                <th scope="col">제출일</th>
                <th scope="col" className="log-queue__pages">
                  제출 쪽수
                </th>
                <th scope="col">상태</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="log-queue__message">
                    {searching
                      ? '조건에 맞는 일지가 없습니다.'
                      : filter === 'SUBMITTED'
                        ? '검토 대기 중인 일지가 없습니다.'
                        : '조회할 독서일지가 없습니다.'}
                  </td>
                </tr>
              )}
              {rows.map((log) => {
                const id = log.readingLogId,
                  open = selected === id;
                const book = log.books[0]?.bookTitle || '도서 미등록';
                const more = log.books.length > 1 ? `외 ${log.books.length - 1}권` : '';
                const detailId = `log-review-detail-${id}`;
                const toggle = () => {
                  if (!processing) onSelect(open ? null : id);
                };
                return (
                  <Fragment key={id}>
                    <tr className="log-queue__row" data-open={open || undefined} onClick={toggle}>
                      <td className="log-cell-book">
                        <button
                          type="button"
                          id={`log-review-row-${id}`}
                          className="log-queue__toggle"
                          aria-label={`${log.userName} ${log.readingDate} 독서일지, ${book} ${more}`.trim()}
                          aria-expanded={open}
                          aria-controls={open ? detailId : undefined}
                          disabled={processing}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle();
                          }}
                        >
                          <span className="log-queue__title" title={book}>
                            {book}
                          </span>
                          {more && <span className="log-queue__more">{more}</span>}
                        </button>
                      </td>
                      <td className="log-cell-name" title={log.userName}>
                        {log.userName}
                      </td>
                      <td className="log-cell-id" title={log.studentNo}>
                        {log.studentNo || '—'}
                      </td>
                      <td className="log-cell-date">
                        <span className="log-queue__mobile-label">독서일 </span>
                        <time dateTime={log.readingDate}>{formatKoDateKey(log.readingDate)}</time>
                      </td>
                      <td className="log-cell-submitted" title={formatKoDateTime24(log.createdAt)}>
                        <span className="log-queue__mobile-label">제출 </span>
                        <time dateTime={log.createdAt}>{formatKoDate(log.createdAt)}</time>
                      </td>
                      <td className="log-queue__pages">{log.totalReadPages.toLocaleString()}쪽</td>
                      <td className="log-cell-status" data-status={log.status}>
                        {labels[log.status]}
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={7} className="log-queue__detail" id={detailId}>
                          {renderDetail(log)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {!!total && (
            <div className="log-queue__footer">
              <span>
                {(page * pageSize + 1).toLocaleString()}–
                {Math.min(total, (page + 1) * pageSize).toLocaleString()} / {total.toLocaleString()}
                건
              </span>
              {pageCount > 1 && (
                <nav aria-label="일지 페이지">
                  <button
                    type="button"
                    aria-label="이전 페이지"
                    disabled={!page || processing}
                    onClick={() => onPage(page - 1)}
                  >
                    이전
                  </button>
                  {pageNumbers.map((n) => (
                    <button
                      type="button"
                      key={n}
                      aria-label={`${n + 1}페이지`}
                      aria-current={page === n ? 'page' : undefined}
                      disabled={processing}
                      onClick={() => onPage(n)}
                    >
                      {n + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-label="다음 페이지"
                    disabled={page + 1 >= pageCount || processing}
                    onClick={() => onPage(page + 1)}
                  >
                    다음
                  </button>
                </nav>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
