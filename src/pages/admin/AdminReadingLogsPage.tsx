import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAdminEvents } from '../../api/adminEventApi';
import {
  approveAdminReadingLog,
  getAdminReadingLogDetail,
  getAdminReadingLogs,
  rejectAdminReadingLog,
} from '../../api/adminReadingLogApi';
import { ApiError, getApiErrorMessage } from '../../api/apiClient';
import ReadingLogReviewPanel from '../../components/admin/readingLogs/ReadingLogReviewPanel';
import { selectEvent } from '../../utils/eventSelection';
import { resolveAdminQueueEvent } from '../../utils/adminEvent';
import ReadingLogQueueList from '../../components/admin/readingLogs/ReadingLogQueueList';
import type { AdminEvent } from '../../types/adminEvent';
import type { AdminReadingLogResponse } from '../../types/adminReadingLogApi';
import '../../styles/admin-reading-logs.css';

type Filter = AdminReadingLogResponse['status'] | 'ALL';
type Search = { query: string; date: string; order: string };
type QueueRequest = {
  status: Filter;
  linkedId?: string | null;
  focus?: { candidates: number[]; search: Search };
};
const PAGE_SIZE = 25;
const initialSearch: Search = { query: '', date: '', order: 'oldest' };

function visibleLogs(logs: AdminReadingLogResponse[], { query, date, order }: Search) {
  const keyword = query.trim().toLocaleLowerCase();
  return logs
    .filter(
      (log) =>
        (!date || log.readingDate === date) &&
        (!keyword ||
          [
            log.userName,
            log.studentNo,
            log.courseName,
            ...log.books.flatMap((book) => [
              book.bookTitle,
              book.author,
              book.publisher,
              book.isbn,
            ]),
          ].some((value) => value?.toLocaleLowerCase().includes(keyword))),
    )
    .sort(
      (a, b) =>
        (order === 'oldest' ? 1 : -1) *
        (a.createdAt.localeCompare(b.createdAt) || a.readingLogId - b.readingLogId),
    );
}

function ReadingQueue({ event, linkedId }: { event: AdminEvent; linkedId: string | null }) {
  const [request, setRequest] = useState<QueueRequest>(() => ({ status: 'SUBMITTED', linkedId }));
  const [linkedStatus, setLinkedStatus] = useState<Filter>('SUBMITTED');
  const filter = request.linkedId != null ? linkedStatus : request.status;
  const [selected, setSelected] = useState<number | null>(null);
  const [logs, setLogs] = useState<AdminReadingLogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [actionError, setActionError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(0);
  const focusAfterLoad = useRef<string | null>(null);
  const mutationLock = useRef(false);
  const frozen = ['FINALIZED', 'ARCHIVED'].includes(event.status);
  useEffect(() => {
    let active = true;
    async function load() {
      let status = request.status;
      let focus = request.focus;
      if (request.linkedId != null) {
        const id = Number(request.linkedId);
        if (!Number.isSafeInteger(id) || id <= 0)
          throw new Error('이 행사의 독서일지를 찾을 수 없습니다.');
        const target = await getAdminReadingLogDetail(id);
        if (target.eventId !== event.eventId)
          throw new Error('이 행사의 독서일지를 찾을 수 없습니다.');
        status = target.status;
        focus = { candidates: [id], search: initialSearch };
      }
      const fresh = await getAdminReadingLogs({
        eventId: event.eventId,
        status: status === 'ALL' ? undefined : status,
      });
      if (!active) return;
      setLogs(fresh);
      if (request.linkedId != null) setLinkedStatus(status);
      if (focus) {
        const visible = visibleLogs(fresh, focus.search);
        const positions = new Map(visible.map((row, index) => [row.readingLogId, index]));
        const id = focus.candidates.find((candidate) => positions.has(candidate));
        if (request.linkedId != null && !id)
          throw new Error('일지 상태가 바뀌었습니다. 다시 조회해 주세요.');
        setSelected(id ?? null);
        if (id != null) {
          setPage(Math.floor(positions.get(id)! / PAGE_SIZE));
          focusAfterLoad.current = 'log-review-row-' + id;
        } else {
          focusAfterLoad.current = 'log-review-count';
        }
      }
      setError('');
    }
    load()
      .catch((e) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : '독서일지를 불러오지 못했습니다.');
        setLogs([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [event.eventId, request]);

  useEffect(() => {
    if (loading || !focusAfterLoad.current) return;
    const target = document.getElementById(focusAfterLoad.current);
    focusAfterLoad.current = null;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'nearest' });
  }, [logs, loading]);

  const rows = useMemo(() => visibleLogs(logs, search), [logs, search]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1));
  function select(id: number | null) {
    setSelected(id);
    setActionError('');
  }
  function updateSearch(patch: Partial<Search>) {
    setSearch((current) => ({ ...current, ...patch }));
    setPage(0);
    select(null);
    setFeedback('');
  }
  function reload(next: QueueRequest) {
    setError('');
    setLoading(true);
    setRequest(next);
  }
  function changeFilter(status: Filter) {
    if (status === filter && !error) return;
    select(null);
    setFeedback('');
    setPage(0);
    setLogs([]);
    reload({ status });
  }
  async function review(log: AdminReadingLogResponse, reason?: string) {
    if (mutationLock.current || loading || frozen || log.status !== 'SUBMITTED') return false;
    mutationLock.current = true;
    setProcessing(true);
    setActionError('');
    setFeedback('');
    try {
      if (reason === undefined) await approveAdminReadingLog(log.readingLogId, log.updatedAt);
      else
        await rejectAdminReadingLog(log.readingLogId, { reason, expectedUpdatedAt: log.updatedAt });
      setFeedback(
        log.userName + ' 님의 일지를 ' + (reason === undefined ? '승인' : '반려') + '했습니다.',
      );
      const index = rows.findIndex((row) => row.readingLogId === log.readingLogId);
      // 대기열에서는 보던 순서로 이어가고, 전체 조회에서는 방금 처리한 결과를 보여 준다.
      const candidates =
        filter === 'SUBMITTED'
          ? [...rows.slice(index + 1), ...rows.slice(0, index).reverse()].map(
              (row) => row.readingLogId,
            )
          : [log.readingLogId];
      reload({ status: filter, focus: { candidates, search } });
      return true;
    } catch (e) {
      if (
        e instanceof ApiError &&
        [
          'READING_LOG_CHANGED',
          'READING_LOG_ALREADY_APPROVED',
          'READING_LOG_ALREADY_REJECTED',
          'BOOK_TOTAL_PAGES_EXCEEDED',
        ].includes(e.code ?? '')
      ) {
        setFeedback(
          e.code === 'BOOK_TOTAL_PAGES_EXCEEDED'
            ? '같은 책의 승인 쪽수가 달라졌습니다. 최신 내용을 확인해 주세요.'
            : '일지 내용 또는 처리 상태가 바뀌었습니다. 최신 내용을 확인해 주세요.',
        );
        select(null);
        reload({ status: filter, focus: { candidates: [log.readingLogId], search } });
      } else {
        setActionError(getApiErrorMessage(e, '일지를 처리하지 못했습니다.'));
      }
      return false;
    } finally {
      mutationLock.current = false;
      setProcessing(false);
    }
  }
  return (
    <ReadingLogQueueList
      rows={rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)}
      total={rows.length}
      page={currentPage}
      pageSize={PAGE_SIZE}
      filter={filter}
      {...search}
      selected={selected}
      loading={loading && !logs.length}
      processing={processing || loading}
      error={error}
      feedback={feedback}
      onFilter={changeFilter}
      onQuery={(query) => updateSearch({ query })}
      onDate={(date) => updateSearch({ date })}
      onOrder={(order) => updateSearch({ order })}
      onPage={(value) => {
        setPage(value);
        select(null);
        setFeedback('');
      }}
      onSelect={select}
      onRetry={() => reload({ ...request })}
      renderDetail={(log) => (
        <ReadingLogReviewPanel
          key={log.readingLogId + '-' + log.updatedAt}
          log={log}
          disabled={processing || loading}
          readOnly={frozen}
          actionError={actionError}
          onApprove={() => review(log)}
          onReject={(reason) => review(log, reason)}
        />
      )}
    />
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
        <h1>독서일지 검토</h1>
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
                {item.title}
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
