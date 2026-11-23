import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAdminEvents } from '../../api/adminEventApi';
import {
  approveAdminReadingLog,
  getAdminReadingLogDetail,
  getAdminReadingLogs,
  rejectAdminReadingLog,
} from '../../api/adminReadingLogApi';
import { getApiErrorMessage } from '../../api/apiClient';
import ReadingLogReviewPanel from '../../components/admin/readingLogs/ReadingLogReviewPanel';
import { selectEvent } from '../../utils/eventSelection';
import { resolveAdminQueueEvent } from '../../utils/adminEvent';
import { formatKoDateKey } from '../../utils/date';
import type { AdminEvent } from '../../types/adminEvent';
import type { AdminReadingLogResponse } from '../../types/adminReadingLogApi';
import '../../styles/admin-reading-logs.css';

const STATUS = { SUBMITTED: '검토 대기', APPROVED: '승인', REJECTED: '반려', ALL: '전체' } as const;
type Filter = keyof typeof STATUS;
const PAGE_SIZE = 25;

function ReadingQueue({ event, linkedId }: { event: AdminEvent; linkedId: string | null }) {
  const [filter, setFilter] = useState<Filter>('SUBMITTED');
  const [selected, setSelected] = useState<number | null>(null);
  const [logs, setLogs] = useState<AdminReadingLogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [processing, setProcessing] = useState(false);
  const [query, setQuery] = useState('');
  const [date, setDate] = useState('');
  const [order, setOrder] = useState('oldest');
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const linkToOpen = useRef(linkedId);
  const mutationLock = useRef(false);
  const frozen = ['FINALIZED', 'ARCHIVED'].includes(event.status);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const initialLink = linkToOpen.current;
      let target: AdminReadingLogResponse | undefined;
      let scope = filter;
      if (initialLink !== null) {
        const id = Number(initialLink);
        if (!Number.isSafeInteger(id) || id <= 0)
          throw new Error('이 행사의 독서일지를 찾을 수 없습니다.');
        target = await getAdminReadingLogDetail(id);
        if (target.eventId !== event.eventId)
          throw new Error('이 행사의 독서일지를 찾을 수 없습니다.');
        scope = target.status;
      }
      const rows = await getAdminReadingLogs({
        eventId: event.eventId,
        status: scope === 'ALL' ? undefined : scope,
      });
      if (!active) return;
      setLogs(rows);
      if (target) {
        if (!rows.some((row) => row.readingLogId === target.readingLogId))
          throw new Error('일지 상태가 달라졌습니다. 목록에서 다시 선택해 주세요.');
        setSelected(target.readingLogId);
        const sorted = [...rows].sort(
          (a, b) => a.createdAt.localeCompare(b.createdAt) || a.readingLogId - b.readingLogId,
        );
        setPage(
          Math.floor(
            sorted.findIndex((row) => row.readingLogId === target.readingLogId) / PAGE_SIZE,
          ),
        );
        linkToOpen.current = null;
        setFilter(scope);
      }
      setError('');
    };
    load()
      .catch((e) => {
        if (active) {
          setError(e instanceof Error ? e.message : '독서일지를 불러오지 못했습니다.');
          setLogs([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [event.eventId, filter, version]);
  const rows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return logs
      .filter(
        (log) =>
          (!date || log.readingDate === date) &&
          (!keyword ||
            [
              log.userName,
              log.studentNo,
              log.courseName,
              ...log.books.flatMap((book) => [book.bookTitle, book.author, book.publisher]),
            ].some((value) => value?.toLowerCase().includes(keyword))),
      )
      .sort(
        (a, b) =>
          (order === 'oldest' ? 1 : -1) *
          (a.createdAt.localeCompare(b.createdAt) || a.readingLogId - b.readingLogId),
      );
  }, [logs, query, date, order]);
  const pages = Math.ceil(rows.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(0, pages - 1));
  function changeFilter(next: Filter) {
    if (next === filter && !error) return;
    linkToOpen.current = null;
    setSelected(null);
    setPage(0);
    setError('');
    setFeedback('');
    setLoading(true);
    if (next === filter) setVersion((v) => v + 1);
    setFilter(next);
  }
  async function review(log: AdminReadingLogResponse, reason?: string) {
    if (mutationLock.current || frozen || log.status !== 'SUBMITTED') return false;
    mutationLock.current = true;
    setProcessing(true);
    setError('');
    setFeedback('');
    try {
      if (reason === undefined) await approveAdminReadingLog(log.readingLogId);
      else await rejectAdminReadingLog(log.readingLogId, { reason });
      setFeedback(
        log.userName + ' 님의 일지를 ' + (reason === undefined ? '승인' : '반려') + '했습니다.',
      );
      setSelected(null);
      setLoading(true);
      setVersion((v) => v + 1);
      return true;
    } catch (e) {
      setError(getApiErrorMessage(e, '일지를 처리하지 못했습니다.'));
      return false;
    } finally {
      mutationLock.current = false;
      setProcessing(false);
    }
  }
  return (
    <section className="admin-queue admin-ledger" aria-label="독서일지 목록">
      <div className="admin-queue__head">
        <h2>독서일지</h2>
        <div className="admin-segmented" aria-label="일지 상태">
          {(Object.keys(STATUS) as Filter[]).map((key) => (
            <button
              type="button"
              key={key}
              aria-pressed={filter === key}
              disabled={processing}
              onClick={() => changeFilter(key)}
            >
              {STATUS[key]}
            </button>
          ))}
        </div>
      </div>
      <div className="admin-queue__tools admin-ledger__tools">
        <input
          type="search"
          aria-label="독서일지 검색"
          placeholder="참가자, 학번, 책 제목, 저자, 출판사"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <input
          type="date"
          aria-label="독서 날짜"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label="정렬"
          value={order}
          onChange={(e) => {
            setOrder(e.target.value);
            setPage(0);
          }}
        >
          <option value="oldest">제출 오래된 순</option>
          <option value="newest">최근 제출 순</option>
        </select>
      </div>
      {error && (
        <p role="alert" className="admin-feedback admin-feedback--error">
          {error}
        </p>
      )}
      {feedback && (
        <p role="status" className="admin-feedback">
          {feedback}
        </p>
      )}
      {loading ? (
        <p role="status" className="admin-queue__message">
          일지를 불러오는 중입니다.
        </p>
      ) : (
        <>
          {!rows.length && !error && (
            <p className="admin-queue__message">
              {query || date
                ? '조건에 맞는 일지가 없습니다.'
                : filter === 'SUBMITTED'
                  ? '검토 대기 중인 일지가 없습니다.'
                  : '해당 상태의 일지가 없습니다.'}
            </p>
          )}
          <ul className="admin-ledger__list">
            {rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((log) => {
              const open = selected === log.readingLogId;
              return (
                <li key={log.readingLogId}>
                  <button
                    type="button"
                    className="admin-ledger__row"
                    aria-expanded={open}
                    disabled={processing}
                    onClick={() => setSelected(open ? null : log.readingLogId)}
                  >
                    <span>{formatKoDateKey(log.readingDate)}</span>
                    <strong>{log.userName}</strong>
                    <span className="admin-ledger__title">
                      {log.books[0]?.bookTitle ?? '도서 미등록'}
                      {log.books.length > 1 && ' 외 ' + (log.books.length - 1) + '권'}
                    </span>
                    <span>{log.totalReadPages.toLocaleString()}쪽</span>
                    <span>{STATUS[log.status]}</span>
                    <span aria-hidden="true">{open ? '−' : '+'}</span>
                  </button>
                  {open && (
                    <ReadingLogReviewPanel
                      log={log}
                      disabled={processing || frozen}
                      onApprove={() => review(log)}
                      onReject={(reason) => review(log, reason)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          {!!rows.length && (
            <nav className="admin-queue__footer" aria-label="일지 페이지">
              <span>
                총 {rows.length.toLocaleString()}건 · {currentPage + 1} / {pages}페이지
              </span>
              {pages > 1 && (
                <>
                  <button
                    type="button"
                    disabled={currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    이전 페이지
                  </button>
                  <button
                    type="button"
                    disabled={currentPage + 1 >= pages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    다음 페이지
                  </button>
                </>
              )}
            </nav>
          )}
        </>
      )}
    </section>
  );
}
export default function AdminReadingLogsPage() {
  const [params, setParams] = useSearchParams();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    getAdminEvents()
      .then((list) => {
        if (active) setEvents(list);
      })
      .catch((e) => {
        if (active) setError(getApiErrorMessage(e, '행사 목록을 불러오지 못했습니다.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const event = resolveAdminQueueEvent(events, params.get('eventId'));
  return (
    <section className="admin-page admin-reading-logs">
      <header className="admin-page__header admin-reading-logs__header">
        <div>
          <h1>독서일지 검토</h1>
          <p>일지를 선택해 도서와 독서량을 확인하고 승인하거나 반려합니다.</p>
        </div>
        <label className="admin-reading-logs__event-selector">
          관리 행사
          <select
            value={event?.eventId ?? ''}
            onChange={(e) => {
              selectEvent('admin', Number(e.target.value));
              setParams({ eventId: e.target.value });
            }}
          >
            {!event && <option value="">행사 선택</option>}
            {events.map((item) => (
              <option key={item.eventId} value={item.eventId}>
                {item.roundNo}회 · {item.title}
              </option>
            ))}
          </select>
        </label>
      </header>
      {error && <p role="alert">{error}</p>}
      {event ? (
        <ReadingQueue
          key={event.eventId + '-' + params.get('logId')}
          event={event}
          linkedId={params.get('logId')}
        />
      ) : (
        !loading && !error && <p role="status">관리할 행사를 선택해 주세요.</p>
      )}
    </section>
  );
}
