import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useLocation,
  useNavigate,
  useSearchParams,
  type SetURLSearchParams,
} from 'react-router-dom';
import { getAdminEvents } from '../../api/adminEventApi';
import {
  approveAdminReadingLog,
  getAdminReadingLogDetail,
  getAdminReadingLogs,
  rejectAdminReadingLog,
} from '../../api/adminReadingLogApi';
import { ApiError, getApiErrorMessage } from '../../api/apiClient';
import ReadingLogDetailView from '../../components/admin/readingLogs/ReadingLogDetailView';
import ReadingLogReviewPanel from '../../components/admin/readingLogs/ReadingLogReviewPanel';
import { selectEvent } from '../../utils/eventSelection';
import { resolveAdminQueueEvent } from '../../utils/adminEvent';
import ReadingLogQueueList from '../../components/admin/readingLogs/ReadingLogQueueList';
import { clampPage } from '../../components/admin/table/pagination';
import {
  DEFAULT_LOG_SORT,
  INITIAL_LOG_SEARCH,
  hasLogFilters,
  logCourseOptions,
  nextPendingLog,
  visibleLogs,
  type LogSearch,
  type LogSort,
} from '../../components/admin/readingLogs/readingLogTable';
import {
  logDetailParams,
  logListParams,
  parseLogId,
  readLogListState,
  writeLogListState,
  type LogFilter,
  type LogListState,
} from '../../components/admin/readingLogs/readingLogParams';
import type { AdminEvent } from '../../types/adminEvent';
import type { AdminReadingLogResponse } from '../../types/adminReadingLogApi';
import '../../styles/admin-reading-logs.css';

type ApprovalIssue = { id: number; message: string };
/** 상세 화면 안내. 어느 일지에 대한 안내인지 함께 두어, 다른 일지로 옮기면 보이지 않게 합니다. */
type Feedback = { logId: number; tone: 'success' | 'warning' | 'error'; text: string };
type LoadedList = {
  key: string;
  status: LogFilter | null;
  logs: AdminReadingLogResponse[];
  error: string;
};
type FetchedLog = { id: number; tick: number; log: AdminReadingLogResponse | null; error: string };
type NavigationState = { fromList?: boolean } | null;

const CONFLICT_CODES = [
  'READING_LOG_CHANGED',
  'READING_LOG_ALREADY_APPROVED',
  'READING_LOG_ALREADY_REJECTED',
  'BOOK_TOTAL_PAGES_EXCEEDED',
];

const AUTO_NEXT_KEY = 'pagepace:admin:log-auto-next';
const LEAVE_WITH_DRAFT =
  '작성 중인 반려 사유가 있습니다. 이동하면 입력한 내용이 사라집니다. 이동할까요?';

function readAutoNext() {
  try {
    return localStorage.getItem(AUTO_NEXT_KEY) !== 'false';
  } catch {
    return true;
  }
}

/** 같은 일지의 두 응답 중 더 최근에 바뀐 쪽을 씁니다. */
function newerLog(left?: AdminReadingLogResponse | null, right?: AdminReadingLogResponse | null) {
  if (!left) return right ?? null;
  if (!right) return left;
  return right.updatedAt > left.updatedAt ? right : left;
}

function ReadingQueue({
  event,
  params,
  setParams,
}: {
  event: AdminEvent;
  params: URLSearchParams;
  setParams: SetURLSearchParams;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationState = location.state as NavigationState;
  const fromList = navigationState?.fromList === true;
  const list = useMemo(() => readLogListState(params), [params]);
  const { status: filter, search, pageSize } = list;
  const logId = parseLogId(params.get('logId'));
  // 다른 화면의 바로가기(상태 없이 logId만 있음)는 일지 상태를 먼저 확인한 뒤 그 상태의 목록을 불러옵니다.
  const linking = logId !== null && !params.has('status');
  const [reloadTick, setReloadTick] = useState(0);
  const listKey = filter + ':' + reloadTick;
  const [loaded, setLoaded] = useState<LoadedList>({ key: '', status: null, logs: [], error: '' });
  const [detailTick, setDetailTick] = useState(0);
  const [fetched, setFetched] = useState<FetchedLog | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [batchNotes, setBatchNotes] = useState<ApprovalIssue[]>([]);
  const [feedback, setFeedback] = useState('');
  const [detailFeedback, setDetailFeedback] = useState<Feedback | null>(null);
  const [actionError, setActionError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [recent, setRecent] = useState<number | null>(null);
  const [autoNext, setAutoNext] = useState(readAutoNext);
  const rejectDraft = useRef(false);
  const prefetched = useRef<string | null>(null);
  const trackRejectDraft = useCallback((dirty: boolean) => {
    rejectDraft.current = dirty;
  }, []);
  const listScroll = useRef<number | null>(null);
  const mutationLock = useRef(false);
  const queueActive = useRef(true);
  const frozen = ['FINALIZED', 'ARCHIVED'].includes(event.status);

  const loading = !linking && loaded.key !== listKey;
  const sameFilter = loaded.status === filter;
  const error = loaded.key === listKey || !sameFilter ? loaded.error : '';
  const logs = loaded.logs;

  useEffect(() => {
    queueActive.current = true;
    return () => {
      queueActive.current = false;
    };
  }, []);

  useEffect(() => {
    if (linking) return;
    // 처리 직후 이미 받아 둔 목록이면 다시 요청하지 않습니다.
    if (prefetched.current === listKey) {
      prefetched.current = null;
      return;
    }
    let active = true;
    getAdminReadingLogs({ eventId: event.eventId, status: filter === 'ALL' ? undefined : filter })
      .then((fresh) => {
        if (active) setLoaded({ key: listKey, status: filter, logs: fresh, error: '' });
      })
      .catch((e) => {
        // 이미 받은 목록은 비우지 않습니다. 상세 이동과 다시 조회에 그대로 씁니다.
        if (active)
          setLoaded((current) => ({
            ...current,
            key: listKey,
            error: getApiErrorMessage(e, '독서일지를 불러오지 못했습니다.'),
          }));
      });
    return () => {
      active = false;
    };
  }, [event.eventId, filter, listKey, linking]);

  const rows = useMemo(
    () => (sameFilter ? visibleLogs(logs, search) : []),
    [sameFilter, logs, search],
  );
  const courseOptions = useMemo(() => logCourseOptions(logs), [logs]);
  const currentPage = clampPage(list.page, rows.length, pageSize);
  const pageRows = rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const listed = logId && sameFilter ? logs.find((log) => log.readingLogId === logId) : undefined;
  const needDetail =
    logId !== null &&
    !Number.isNaN(logId) &&
    (linking || (!loading && !listed)) &&
    !(fetched?.id === logId && fetched.tick === detailTick);

  useEffect(() => {
    if (!needDetail || logId === null) return;
    let active = true;
    getAdminReadingLogDetail(logId)
      .then((target) => {
        if (!active) return;
        if (target.eventId !== event.eventId) {
          setFetched({
            id: logId,
            tick: detailTick,
            log: null,
            error: '선택한 관리 행사의 독서일지가 아닙니다. 관리 행사를 확인해 주세요.',
          });
          return;
        }
        setFetched({ id: logId, tick: detailTick, log: target, error: '' });
        if (linking) {
          const next = new URLSearchParams(params);
          next.set('status', target.status);
          setParams(next, { replace: true, state: navigationState });
        }
      })
      .catch((e) => {
        if (active)
          setFetched({
            id: logId,
            tick: detailTick,
            log: null,
            error: getApiErrorMessage(e, '독서일지를 불러오지 못했습니다.'),
          });
      });
    return () => {
      active = false;
    };
  }, [needDetail, logId, detailTick, linking, event.eventId, params, setParams, navigationState]);

  const current =
    logId === null ? null : newerLog(listed, fetched?.id === logId ? fetched.log : null);
  const detailError =
    logId !== null && Number.isNaN(logId)
      ? '일지 주소가 올바르지 않습니다.'
      : !current && fetched?.id === logId
        ? fetched.error
        : '';
  const index = current ? rows.findIndex((row) => row.readingLogId === current.readingLogId) : -1;

  // 상세에서 목록으로 돌아오면 이전 스크롤 위치와 마지막으로 본 행으로 돌아갑니다.
  // 그 일지가 처리되어 목록에 없으면 건수 제목으로 초점을 옮깁니다.
  useEffect(() => {
    if (logId !== null || loading || listScroll.current === null) return;
    window.scrollTo(0, listScroll.current);
    listScroll.current = null;
    const row = recent === null ? null : document.getElementById('log-review-row-' + recent);
    (row ?? document.getElementById('log-review-count'))?.focus({ preventScroll: true });
  }, [logId, loading, recent]);

  // 반려 사유를 쓰는 중에 새로고침하거나 창을 닫으면 브라우저 확인 창을 띄웁니다.
  useEffect(() => {
    if (logId === null) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (rejectDraft.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [logId]);

  function clearChecks() {
    setChecked(new Set());
    setBatchNotes([]);
  }
  function setList(patch: Partial<LogListState>) {
    clearChecks();
    setFeedback('');
    setParams(writeLogListState(params, { ...list, ...patch }), { replace: true });
  }
  function updateSearch(patch: Partial<LogSearch>) {
    setList({ search: { ...search, ...patch }, page: 0 });
  }
  function sortBy(column: LogSort['column']) {
    const descending = search.sort.column === column && search.sort.direction === 'ascending';
    updateSearch({ sort: { column, direction: descending ? 'descending' : 'ascending' } });
  }
  function changeFilter(status: LogFilter) {
    if (status === filter && !error) return;
    const sort =
      status !== 'ALL' && search.sort.column === 'status' ? DEFAULT_LOG_SORT : search.sort;
    setList({ status, search: { ...search, sort }, page: 0 });
  }
  function reload() {
    setReloadTick((tick) => tick + 1);
  }

  /** 반려 사유를 쓰는 중이면 이동 전에 확인합니다. */
  function canLeave() {
    if (!rejectDraft.current) return true;
    if (!window.confirm(LEAVE_WITH_DRAFT)) return false;
    rejectDraft.current = false;
    return true;
  }

  /** 상세 화면 열기. 목록에서 들어오면 기록을 쌓고, 상세 안에서의 이동은 기록을 바꿔 뒤로 가기가 목록으로 가게 합니다. */
  function openLog(id: number, fromDetail = false, sourceRows = rows) {
    const position = sourceRows.findIndex((row) => row.readingLogId === id);
    const page = position >= 0 ? Math.floor(position / pageSize) : list.page;
    if (!fromDetail) listScroll.current = window.scrollY;
    clearChecks();
    setFeedback('');
    setActionError('');
    setDetailFeedback(null);
    setRecent(id);
    setParams(logDetailParams(params, { ...list, page }, id), {
      replace: fromDetail,
      state: { fromList: fromDetail ? fromList : true },
    });
  }
  function backToList() {
    setDetailFeedback(null);
    setActionError('');
    if (fromList) navigate(-1);
    else setParams(logListParams(params), { replace: true });
  }

  /**
   * 승인·반려. 서버가 성공을 돌려준 뒤에만 결과를 반영합니다. 검토 대기 목록에서 자동 이동이 켜져 있으면
   * 최신 대기 목록을 다시 받아 같은 조건의 다음 일지로 옮기고, 남은 일지가 없으면 목록으로 돌아갑니다.
   * 실패·충돌이면 이동하지 않고 현재 일지에 머뭅니다.
   */
  async function review(log: AdminReadingLogResponse, reason?: string) {
    if (mutationLock.current || loading || frozen || log.status !== 'SUBMITTED') return false;
    mutationLock.current = true;
    setProcessing(true);
    setActionError('');
    setDetailFeedback(null);
    const verb = reason === undefined ? '승인' : '반려';
    const before = rows;
    try {
      let updated: AdminReadingLogResponse | null;
      try {
        updated =
          reason === undefined
            ? await approveAdminReadingLog(log.readingLogId, log.updatedAt)
            : await rejectAdminReadingLog(log.readingLogId, {
                reason,
                expectedUpdatedAt: log.updatedAt,
              });
      } catch (e) {
        if (e instanceof ApiError && CONFLICT_CODES.includes(e.code ?? '')) {
          setDetailFeedback({
            logId: log.readingLogId,
            tone: 'error',
            text:
              e.code === 'BOOK_TOTAL_PAGES_EXCEEDED'
                ? '같은 책의 승인 쪽수가 달라졌습니다. 최신 내용을 확인해 주세요.'
                : '일지 내용 또는 처리 상태가 바뀌었습니다. 최신 내용을 확인해 주세요.',
          });
          setDetailTick((tick) => tick + 1);
          reload();
        } else {
          setActionError(getApiErrorMessage(e, '일지를 처리하지 못했습니다.'));
        }
        return false;
      }

      rejectDraft.current = false;
      const done = `${log.userName} 님의 일지를 ${verb}했습니다.`;
      if (updated) setFetched({ id: log.readingLogId, tick: detailTick, log: updated, error: '' });
      if (!autoNext || filter !== 'SUBMITTED') {
        setDetailFeedback({ logId: log.readingLogId, tone: 'success', text: done });
        reload();
        return true;
      }

      let fresh: AdminReadingLogResponse[];
      try {
        fresh = await getAdminReadingLogs({ eventId: event.eventId, status: 'SUBMITTED' });
      } catch {
        // 처리는 끝났으므로 실패로 알리거나 다시 보내지 않습니다. 이동만 멈추고 두 결과를 나눠 알립니다.
        setDetailFeedback({
          logId: log.readingLogId,
          tone: 'warning',
          text: `${done} 다만 다음 검토 대기 목록을 불러오지 못해 이동하지 않았습니다. 목록에서 다시 조회해 주세요.`,
        });
        reload();
        return true;
      }
      if (!queueActive.current) return true;
      const tick = reloadTick + 1;
      prefetched.current = filter + ':' + tick;
      setReloadTick(tick);
      setLoaded({ key: filter + ':' + tick, status: filter, logs: fresh, error: '' });
      const nextRows = visibleLogs(fresh, search);
      const nextId = nextPendingLog(before, log.readingLogId, nextRows);
      if (nextId !== null) {
        openLog(nextId, true, nextRows);
        setDetailFeedback({ logId: nextId, tone: 'success', text: `${done} 다음 일지입니다.` });
      } else {
        backToList();
        setFeedback(
          `${done} ${hasLogFilters(search) ? '현재 조건에 남은' : '남은'} 검토 대기 일지가 없습니다.`,
        );
      }
      return true;
    } finally {
      mutationLock.current = false;
      setProcessing(false);
    }
  }
  function canSelect(log: AdminReadingLogResponse) {
    return (
      !frozen &&
      log.status === 'SUBMITTED' &&
      log.books.length > 0 &&
      !log.books.some((book) => book.pageExceeded)
    );
  }
  async function approveChecked() {
    if (mutationLock.current || loading || frozen) return;
    const targets = pageRows.filter((log) => checked.has(log.readingLogId) && canSelect(log));
    if (!targets.length) return;
    mutationLock.current = true;
    setProcessing(true);
    setActionError('');
    setBatchNotes([]);
    const notes: ApprovalIssue[] = [];
    let approved = 0;
    let refused = 0;
    let unconfirmed = 0;
    try {
      for (const [index, log] of targets.entries()) {
        if (!queueActive.current) return;
        setFeedback(`선택한 ${targets.length}건 중 ${index + 1}번째 일지 승인 중…`);
        try {
          await approveAdminReadingLog(log.readingLogId, log.updatedAt);
          approved++;
        } catch (err) {
          const label = `${log.userName} (${log.studentNo}) · ${log.books[0].bookTitle}`;
          if (!(err instanceof ApiError) || err.status < 400 || err.status >= 500) {
            unconfirmed++;
            notes.push({
              id: log.readingLogId,
              message: label + ' — 승인 응답을 확인하지 못했습니다. 갱신된 상태를 확인해 주세요.',
            });
            break;
          }
          refused++;
          notes.push({ id: log.readingLogId, message: label + ' — ' + err.message });
          if (err.status === 401 || err.status === 403) break;
        }
      }
      if (!queueActive.current) return;
      const remaining = targets.length - approved - refused - unconfirmed;
      const result = [`승인 ${approved}건`];
      if (refused) result.push(`승인 실패 ${refused}건`);
      if (unconfirmed) result.push(`결과 확인 필요 ${unconfirmed}건`);
      if (remaining) result.push(`미처리 ${remaining}건`);
      setFeedback(result.join(' · '));
      setBatchNotes(notes);
      setChecked(new Set());
      reload();
    } finally {
      mutationLock.current = false;
      setProcessing(false);
    }
  }

  if (logId !== null) {
    return (
      <ReadingLogDetailView
        log={current}
        position={index >= 0 ? { index, total: rows.length } : null}
        loading={!current && !detailError}
        error={detailError}
        busy={processing}
        feedback={
          detailFeedback?.logId === logId && (
            <p
              className={`log-detail__feedback log-detail__feedback--${detailFeedback.tone}`}
              role={detailFeedback.tone === 'error' ? 'alert' : 'status'}
            >
              {detailFeedback.text}
            </p>
          )
        }
        onList={() => canLeave() && backToList()}
        onPrevious={
          index > 0 ? () => canLeave() && openLog(rows[index - 1].readingLogId, true) : undefined
        }
        onNext={
          index >= 0 && index < rows.length - 1
            ? () => canLeave() && openLog(rows[index + 1].readingLogId, true)
            : undefined
        }
        autoNext={
          filter === 'SUBMITTED' && current?.status === 'SUBMITTED' && !frozen
            ? {
                checked: autoNext,
                onChange: (checked) => {
                  setAutoNext(checked);
                  try {
                    localStorage.setItem(AUTO_NEXT_KEY, String(checked));
                  } catch {
                    /* 저장하지 못해도 이번 화면에서는 그대로 동작합니다. */
                  }
                },
              }
            : undefined
        }
      >
        {current && (
          <ReadingLogReviewPanel
            key={current.readingLogId + '-' + current.updatedAt}
            log={current}
            disabled={processing || loading}
            readOnly={frozen}
            actionError={actionError}
            onApprove={() => review(current)}
            onReject={(reason) => review(current, reason)}
            onRejectDraftChange={trackRejectDraft}
          />
        )}
      </ReadingLogDetailView>
    );
  }

  return (
    <>
      {batchNotes.length > 0 && (
        <details className="log-batch-notes" open>
          <summary>승인 결과 확인 ({batchNotes.length}건)</summary>
          <ul>
            {batchNotes.map((note) => (
              <li key={note.id}>{note.message}</li>
            ))}
          </ul>
        </details>
      )}
      <ReadingLogQueueList
        rows={pageRows}
        total={rows.length}
        page={currentPage}
        pageSize={pageSize}
        filter={filter}
        {...search}
        recent={recent}
        selectedIds={checked}
        onSelectionChange={setChecked}
        canSelect={canSelect}
        onApproveSelection={() => void approveChecked()}
        onPageSize={(size) => setList({ pageSize: size, page: 0 })}
        loading={loading && !rows.length}
        processing={processing || loading}
        error={error}
        feedback={feedback}
        onFilter={changeFilter}
        onQuery={(query) => updateSearch({ query })}
        courseOptions={courseOptions}
        onDates={(patch) => updateSearch(patch)}
        onCourse={(course) => updateSearch({ course })}
        onSort={sortBy}
        onReset={() => setList({ status: 'SUBMITTED', search: INITIAL_LOG_SEARCH, page: 0 })}
        onPage={(page) => setList({ page })}
        onOpen={(id) => openLog(id)}
        onRetry={reload}
        onRefresh={() => {
          clearChecks();
          setFeedback('');
          reload();
        }}
      />
    </>
  );
}
export default function AdminReadingLogsPage() {
  const [params, setParams] = useSearchParams();
  const [attempt, setAttempt] = useState(0);
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
  }, [attempt]);
  const event = resolveAdminQueueEvent(events, params.get('eventId'));
  return (
    <section className="admin-page admin-reading-logs">
      <header className="roster-heading">
        <h1>독서일지 검토</h1>
        <div className="roster-heading-actions">
          <label>
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
        </div>
      </header>
      {error && (
        <div className="roster-error" role="alert">
          {error}
          <button
            type="button"
            className="roster-link"
            onClick={() => {
              setError('');
              setLoading(true);
              setAttempt((value) => value + 1);
            }}
          >
            다시 조회
          </button>
        </div>
      )}
      {event ? (
        <ReadingQueue key={event.eventId} event={event} params={params} setParams={setParams} />
      ) : (
        !loading && !error && <p role="status">관리할 행사를 선택해 주세요.</p>
      )}
    </section>
  );
}
