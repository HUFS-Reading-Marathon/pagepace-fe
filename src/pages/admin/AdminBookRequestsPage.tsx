import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useLocation,
  useNavigate,
  useSearchParams,
  type SetURLSearchParams,
} from 'react-router-dom';
import { ApiError, getApiErrorMessage } from '../../api/apiClient';
import { getAdminEvents } from '../../api/adminEventApi';
import {
  approveBookRequest,
  getBookRequests,
  rejectBookRequest,
  type BookRequest,
} from '../../api/bookRequestApi';
import BookRequestDetail from '../../components/admin/bookRequests/BookRequestDetail';
import BookRequestProcessPanel from '../../components/admin/bookRequests/BookRequestProcessPanel';
import BookRequestTable from '../../components/admin/bookRequests/BookRequestTable';
import {
  bookRequestCounts,
  INITIAL_BOOK_REQUEST_SEARCH,
  parseRequestId,
  readBookRequestListState,
  visibleBookRequests,
  writeBookRequestListState,
  type BookRequestListState,
} from '../../components/admin/bookRequests/bookRequestList';
import { clampPage } from '../../components/admin/table/pagination';
import { nextCandidateId } from '../../components/admin/table/queueNavigation';
import type { AdminEvent } from '../../types/adminEvent';
import { resolveAdminQueueEvent } from '../../utils/adminEvent';
import { selectEvent } from '../../utils/eventSelection';
import '../../styles/admin-participants.css';

type NavigationState = { fromList?: boolean } | null;
type Feedback = { requestId: number; tone: 'success' | 'warning' | 'error'; text: string };

const AUTO_NEXT_KEY = 'pagepace:admin:book-request-auto-next';
const LEAVE_WITH_DRAFT =
  '선택한 판본이나 작성 중인 반려 사유가 있습니다. 이동하면 입력한 내용이 사라집니다. 이동할까요?';
/** 다른 관리자가 먼저 처리한 요청 (서버 ConflictException 코드) */
const PROCESSED_CODES = ['BOOK_REQUEST_PROCESSED'];

function readAutoNext() {
  try {
    return localStorage.getItem(AUTO_NEXT_KEY) !== 'false';
  } catch {
    return true;
  }
}

function BookRequestQueue({
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
  const listState = useMemo(() => readBookRequestListState(params), [params]);
  const { search, pageSize } = listState;
  // requestId가 있으면 상세 화면입니다.
  const selectedId = parseRequestId(params.get('requestId'));

  const [rows, setRows] = useState<BookRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [listError, setListError] = useState('');
  const [reloading, setReloading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);
  const [listFeedback, setListFeedback] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [recent, setRecent] = useState<number | null>(null);
  const [autoNext, setAutoNext] = useState(readAutoNext);
  const draft = useRef(false);
  const [hasDraft, setHasDraft] = useState(false);
  const trackDraft = useCallback((dirty: boolean) => {
    draft.current = dirty;
    setHasDraft(dirty);
  }, []);
  const listScroll = useRef<number | null>(null);

  /** 최신 요청 목록. 실패하면 마지막 목록을 그대로 두고 null을 돌려줍니다. */
  const refresh = useCallback(async () => {
    try {
      const next = await getBookRequests(event.eventId, true);
      setRows(next);
      setHasLoaded(true);
      setListError('');
      return next;
    } catch (error) {
      setListError(getApiErrorMessage(error, '도서 확인 요청을 불러오지 못했습니다.'));
      return null;
    }
  }, [event.eventId]);

  useEffect(() => {
    let active = true;
    getBookRequests(event.eventId, true)
      .then((next) => {
        if (!active) return;
        setRows(next);
        setHasLoaded(true);
      })
      .catch((error) => {
        if (active)
          setListError(getApiErrorMessage(error, '도서 확인 요청을 불러오지 못했습니다.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [event.eventId]);

  const counts = useMemo(() => bookRequestCounts(rows), [rows]);
  const visible = useMemo(() => visibleBookRequests(rows, search), [rows, search]);
  const currentPage = clampPage(listState.page, visible.length, pageSize);
  const pageRows = visible.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const active =
    selectedId === null || Number.isNaN(selectedId)
      ? undefined
      : rows.find((row) => row.id === selectedId);
  const activeIndex = active ? visible.indexOf(active) : -1;

  // 다른 화면에서 처리된 요청을 바로 열면, 그 상태로 목록 조건을 맞춰 이전·다음 이동을 그 안에서 합니다.
  const adoptFilter =
    !loading && !!active && !params.has('status') && !fromList && active.status !== 'PENDING';
  useEffect(() => {
    if (!adoptFilter || !active) return;
    const next = new URLSearchParams(params);
    next.set('status', active.status);
    setParams(next, { replace: true, state: navigationState });
  }, [adoptFilter, active, params, setParams, navigationState]);

  // 상세에서 목록으로 돌아오면 이전 스크롤 위치와 마지막으로 본 행으로 돌아갑니다.
  const wasDetail = useRef(false);
  useEffect(() => {
    if (selectedId !== null) {
      wasDetail.current = true;
      return;
    }
    if (!wasDetail.current) return;
    wasDetail.current = false;
    window.scrollTo(0, listScroll.current ?? 0);
    listScroll.current = null;
    const row = recent === null ? null : document.getElementById('book-request-row-' + recent);
    (row ?? document.getElementById('book-request-count'))?.focus({ preventScroll: true });
  }, [selectedId, recent]);

  // 처리 전 입력이 있을 때 새로고침하거나 창을 닫으면 브라우저 확인 창을 띄웁니다.
  useEffect(() => {
    if (!hasDraft) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasDraft]);

  /** 목록 조건 변경: 빠르게 이어지는 입력이 서로 덮어쓰지 않도록 최신 주소 파라미터를 기준으로 계산합니다. */
  const setList = (update: (current: BookRequestListState) => Partial<BookRequestListState>) => {
    setListFeedback('');
    setParams(
      (latest) => {
        const current = readBookRequestListState(latest);
        return writeBookRequestListState(latest, { ...current, ...update(current) });
      },
      { replace: true },
    );
  };

  const canLeave = () => {
    if (!draft.current) return true;
    if (!window.confirm(LEAVE_WITH_DRAFT)) return false;
    trackDraft(false);
    return true;
  };

  /** 상세 화면 열기. 목록에서 들어오면 기록을 쌓고, 상세 안에서의 이동은 기록을 바꿔 뒤로 가기가 목록으로 가게 합니다. */
  const openRequest = (requestId: number, fromDetail = false, sourceRows = visible) => {
    const position = sourceRows.findIndex((row) => row.id === requestId);
    const page = position >= 0 ? Math.floor(position / pageSize) : listState.page;
    if (!fromDetail) listScroll.current = window.scrollY;
    setRecent(requestId);
    const next = writeBookRequestListState(params, { ...listState, page });
    next.set('requestId', String(requestId));
    setParams(next, { replace: fromDetail, state: { fromList: fromDetail ? fromList : true } });
  };

  const backToList = (message = '') => {
    setFeedback(null);
    setListFeedback(message);
    if (fromList) {
      navigate(-1);
      return;
    }
    const next = new URLSearchParams(params);
    next.delete('requestId');
    setParams(next, { replace: true });
  };

  const retryList = async () => {
    if (reloading) return;
    setReloading(true);
    setListFeedback('');
    await refresh();
    setReloading(false);
  };

  /**
   * 서버에서 처리가 성공한 뒤에만 결과를 반영합니다. 확인 대기 목록에서 자동 이동이 켜져 있으면 최신 목록을
   * 다시 받아 같은 검색·정렬 조건의 다음 대기 요청으로 옮기고, 남은 요청이 없으면 목록으로 돌아갑니다.
   * 실패하면 현재 요청과 입력한 값을 그대로 둡니다.
   */
  const process = async (
    request: BookRequest,
    send: () => Promise<BookRequest>,
    done: (updated: BookRequest) => string,
  ) => {
    if (processingRef.current) return false;
    processingRef.current = true;
    setProcessing(true);
    setFeedback(null);
    const beforeIds = visible.map((row) => row.id);
    try {
      let updated: BookRequest;
      try {
        updated = await send();
      } catch (error) {
        if (error instanceof ApiError && PROCESSED_CODES.includes(error.code ?? '')) {
          // 다른 관리자가 먼저 처리했습니다. 최신 상태를 불러오고 이 요청에 머뭅니다.
          // 서버에서 처리된 요청이면 처리 영역이 사라지고, 아직 대기라면 입력한 값을 그대로 둡니다.
          await refresh();
          setFeedback({
            requestId: request.id,
            tone: 'warning',
            text: `${getApiErrorMessage(error, '이미 처리된 요청입니다.')} 최신 상태를 불러왔습니다.`,
          });
        } else {
          setFeedback({
            requestId: request.id,
            tone: 'error',
            text: getApiErrorMessage(error, '요청을 처리하지 못했습니다. 다시 시도해 주세요.'),
          });
        }
        return false;
      }

      setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      trackDraft(false);
      const message = done(updated);
      if (!autoNext || search.filter !== 'PENDING') {
        setFeedback({ requestId: request.id, tone: 'success', text: message });
        return true;
      }
      const fresh = await refresh();
      if (!fresh) {
        setFeedback({
          requestId: request.id,
          tone: 'warning',
          text: `${message} 다음 요청 목록을 불러오지 못해 이 화면에 머뭅니다. 목록을 새로고침해 주세요.`,
        });
        return true;
      }
      const nextRows = visibleBookRequests(fresh, search);
      const nextId = nextCandidateId(
        beforeIds,
        request.id,
        nextRows.map((row) => row.id),
      );
      if (nextId === null) {
        backToList(`${message} 남은 확인 대기 요청이 없습니다.`);
      } else {
        setFeedback({ requestId: nextId, tone: 'success', text: `${message} 다음 요청입니다.` });
        openRequest(nextId, true, nextRows);
      }
      return true;
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  if (selectedId !== null) {
    const invalid = Number.isNaN(selectedId);
    const detailError = invalid
      ? '요청 번호가 올바르지 않습니다.'
      : !loading && !active
        ? listError && !hasLoaded
          ? listError
          : '이 행사에서 해당 도서 확인 요청을 찾을 수 없습니다.'
        : '';
    const go = (offset: number) => {
      const target = visible[activeIndex + offset];
      if (target && canLeave()) {
        setFeedback(null);
        openRequest(target.id, true);
      }
    };
    const shownFeedback = feedback && active && feedback.requestId === active.id ? feedback : null;
    return (
      <BookRequestDetail
        request={active ?? null}
        position={activeIndex >= 0 ? { index: activeIndex, total: visible.length } : null}
        loading={loading}
        error={detailError}
        busy={processing}
        feedback={
          shownFeedback && (
            <p
              className={`log-detail__feedback log-detail__feedback--${shownFeedback.tone}`}
              role={shownFeedback.tone === 'error' ? 'alert' : 'status'}
            >
              {shownFeedback.text}
            </p>
          )
        }
        onList={() => canLeave() && backToList()}
        onPrevious={activeIndex > 0 ? () => go(-1) : undefined}
        onNext={activeIndex >= 0 && activeIndex < visible.length - 1 ? () => go(1) : undefined}
        autoNext={
          active?.status === 'PENDING' && search.filter === 'PENDING'
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
        {active?.status === 'PENDING' && (
          <BookRequestProcessPanel
            key={active.id}
            request={active}
            processing={processing}
            onDraftChange={trackDraft}
            onApprove={(book) =>
              process(
                active,
                () => approveBookRequest(active.id, book),
                () =>
                  `${active.participantName} 님의 요청을 “${book.bookTitle}” 판본으로 일지 심사에 이관했습니다.`,
              )
            }
            onReject={(reason) =>
              process(
                active,
                () => rejectBookRequest(active.id, reason),
                () => `${active.participantName} 님의 요청을 반려했습니다.`,
              )
            }
          />
        )}
      </BookRequestDetail>
    );
  }

  return (
    <BookRequestTable
      rows={pageRows}
      total={visible.length}
      page={currentPage}
      pageSize={pageSize}
      search={search}
      counts={counts}
      loading={loading}
      busy={reloading}
      error={listError}
      hasLoaded={hasLoaded}
      feedback={listFeedback}
      recent={recent}
      onSearch={(patch) =>
        setList((current) => ({ search: { ...current.search, ...patch }, page: 0 }))
      }
      onReset={() => setList(() => ({ search: INITIAL_BOOK_REQUEST_SEARCH, page: 0 }))}
      onRefresh={() => void retryList()}
      onPage={(page) => setList(() => ({ page }))}
      onPageSize={(size) => setList(() => ({ pageSize: size, page: 0 }))}
      onOpen={(row) => openRequest(row.id)}
    />
  );
}

/** 관리자 도서 확인 요청: 확인 대기 요청 표와 요청별 독립 검토 화면 */
export default function AdminBookRequestsPage() {
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
    <section className="admin-page admin-book-requests">
      <header className="roster-heading">
        <h1>도서 확인 요청</h1>
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
        <BookRequestQueue key={event.eventId} event={event} params={params} setParams={setParams} />
      ) : (
        !loading &&
        !error &&
        (params.get('eventId') !== null && events.length ? (
          <p role="status">링크의 행사를 찾을 수 없습니다. 관리 행사를 선택해 주세요.</p>
        ) : (
          <p role="status">관리할 행사를 선택해 주세요.</p>
        ))
      )}
    </section>
  );
}
