import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  approveAdminReadingLog,
  getAdminReadingLogDetail,
  getAdminReadingLogs,
  rejectAdminReadingLog,
} from '../../api/adminReadingLogApi';
import { getApiErrorMessage } from '../../api/apiClient';
import { getAdminEvents } from '../../api/adminEventApi';
import ReadingLogReviewPanel from '../../components/admin/readingLogs/ReadingLogReviewPanel';
import ReadingLogStatusBadge from '../../components/admin/readingLogs/ReadingLogStatusBadge';
import type { AdminEvent, EventStatus } from '../../types/adminEvent';
import {
  READING_LOG_REVIEW_OPTIONS,
  getReadingLogTotalPages,
  validateReadingLog,
  type AdminReadingLog,
  type ReadingLogReviewFilter,
  type ReadingLogStatus,
  type ReadingLogStatusFilter,
} from '../../types/adminReadingLog';
import type {
  AdminReadingLogResponse,
  AdminReadingLogStatus,
} from '../../types/adminReadingLogApi';
import { chooseAdminEventId } from '../../utils/adminEvent';
import { formatKoDateKey } from '../../utils/date';
import { useRememberedAdminEvent } from '../../hooks/useRememberedAdminEvent';
import '../../styles/admin-reading-logs.css';

type QueueSort = 'oldest' | 'newest';

type DetailState = {
  logId: string;
  log: AdminReadingLog | null;
  error: string | null;
};

/** 상단 상태 필터. 검토 대기를 기본으로 두어 들어오자마자 처리할 일지부터 보이게 합니다. */
const QUEUE_TABS: ReadonlyArray<{
  label: string;
  status: ReadingLogStatusFilter;
  review: ReadingLogReviewFilter;
}> = [
  { label: '검토 대기', status: 'submit', review: 'ALL' },
  { label: '확인 필요', status: 'ALL', review: 'warning' },
  { label: '승인', status: 'approve', review: 'ALL' },
  { label: '반려', status: 'rejected', review: 'ALL' },
  { label: '전체', status: 'ALL', review: 'ALL' },
];

const NARROW_LAYOUT_QUERY = '(max-width: 1180px)';

const STATUS_MAP: Record<AdminReadingLogStatus, ReadingLogStatus> = {
  SUBMITTED: 'submit',
  APPROVED: 'approve',
  REJECTED: 'rejected',
};

const DEFAULT_EVENT_SELECTION_ORDER: EventStatus[] = [
  'APPLICATION_OPEN',
  'READY',
  'IN_PROGRESS',
  'DRAFT',
];

function toDisplayLog(log: AdminReadingLogResponse): AdminReadingLog {
  const sortedBooks = [...log.books].sort(
    (first, second) => first.displayOrder - second.displayOrder,
  );

  return {
    id: String(log.readingLogId),
    participantName: log.userName || '-',
    studentNumber: log.studentNo || '-',
    readingDate: log.readingDate,
    submittedAt: log.createdAt,
    status: STATUS_MAP[log.status],
    approvedAt: log.reviewedAt || undefined,
    rejectionReason: log.status === 'REJECTED' ? log.adminComment || undefined : undefined,
    totalReadPages: log.totalReadPages,
    convertedDistanceMeter: log.convertedDistanceMeter,
    eventTitle: log.eventTitle,
    courseName: log.courseName,
    recommendedRejectReasons: log.recommendedRejectReasons ?? [],
    books: sortedBooks.map((book) => ({
      id: String(book.readingLogBookId),
      title: book.bookTitle || '-',
      author: book.author || '-',
      publisher: book.publisher || '-',
      totalPages: book.totalBookPages,
      previouslyApprovedPages: book.existingApprovedReadPages,
      readPages: book.submittedReadPages,
      expectedApprovedPages: book.expectedApprovedReadPages,
      remainingPagesAfterApproval: book.remainingPagesAfterApproval,
      pageExceeded: book.pageExceeded,
      warningMessage: book.warningMessage || undefined,
    })),
  };
}

function AdminReadingLogsPage() {
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  useRememberedAdminEvent(selectedEventId);
  const [logs, setLogs] = useState<AdminReadingLog[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReadingLogStatusFilter>('submit');
  const [reviewFilter, setReviewFilter] = useState<ReadingLogReviewFilter>('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<QueueSort>('oldest');
  // 오늘의 업무 등에서 ?logId=로 들어오면 해당 일지를 먼저 엽니다.
  const [selectedLogId, setSelectedLogId] = useState<string | null>(() =>
    searchParams.get('logId'),
  );
  const [detailState, setDetailState] = useState<DetailState | null>(null);
  const [detailVersion, setDetailVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingLogId, setProcessingLogId] = useState<number | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const initialRequestRef = useRef<Promise<{
    events: AdminEvent[];
    eventId: number | null;
  }> | null>(null);
  const requestSequenceRef = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const statistics = useMemo(
    () => ({
      total: logs.length,
      submit: logs.filter((log) => log.status === 'submit').length,
      approve: logs.filter((log) => log.status === 'approve').length,
      rejected: logs.filter((log) => log.status === 'rejected').length,
      warning: logs.filter((log) => validateReadingLog(log).length > 0).length,
    }),
    [logs],
  );

  const getTabCount = (tab: (typeof QUEUE_TABS)[number]) => {
    if (tab.review === 'warning') return statistics.warning;
    if (tab.status === 'ALL') return statistics.total;
    return statistics[tab.status];
  };

  const filteredLogs = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();
    const direction = sortOrder === 'oldest' ? 1 : -1;

    return logs
      .filter((log) => {
        const searchableValues = [
          log.participantName,
          log.studentNumber,
          log.courseName ?? '',
          ...log.books.flatMap((book) => [book.title, book.author, book.publisher]),
        ];
        const matchesKeyword =
          !normalizedKeyword ||
          searchableValues.some((value) => value.toLowerCase().includes(normalizedKeyword));
        const matchesStatus = statusFilter === 'ALL' || log.status === statusFilter;
        const hasWarning = validateReadingLog(log).length > 0;
        const matchesReview =
          reviewFilter === 'ALL' || (reviewFilter === 'warning' ? hasWarning : !hasWarning);
        const matchesDate = !dateFilter || log.readingDate === dateFilter;

        return matchesKeyword && matchesStatus && matchesReview && matchesDate;
      })
      .sort(
        (firstLog, secondLog) =>
          direction *
          (new Date(firstLog.submittedAt).getTime() - new Date(secondLog.submittedAt).getTime()),
      );
  }, [dateFilter, logs, reviewFilter, searchKeyword, sortOrder, statusFilter]);

  // 선택한 일지가 현재 목록에 없으면(필터 변경·처리 완료 등) 목록의 첫 일지를 보여 줍니다.
  const activeLogId =
    selectedLogId && filteredLogs.some((log) => log.id === selectedLogId)
      ? selectedLogId
      : (filteredLogs[0]?.id ?? null);
  const activeIndex = filteredLogs.findIndex((log) => log.id === activeLogId);
  const activeListLog = activeIndex >= 0 ? filteredLogs[activeIndex] : undefined;
  const activeDetail = detailState?.logId === activeLogId ? detailState : null;
  const activeLog = activeDetail?.log ?? activeListLog;
  const isDetailLoading = activeLogId !== null && activeDetail === null;
  const hasActiveFilters = Boolean(searchKeyword.trim() || dateFilter || reviewFilter !== 'ALL');

  /** 처리한 일지 다음에 볼 검토 대기 일지(없으면 null)를 현재 목록 순서 기준으로 고릅니다. */
  const findNextPendingId = (logId: string) => {
    const index = filteredLogs.findIndex((log) => log.id === logId);
    const ordered = [
      ...filteredLogs.slice(index + 1),
      ...filteredLogs.slice(0, Math.max(index, 0)),
    ];

    return ordered.find((log) => log.status === 'submit' && log.id !== logId)?.id ?? null;
  };

  const loadLogs = useCallback(async (eventId: number) => {
    const requestSequence = ++requestSequenceRef.current;
    setIsLoading(true);

    try {
      const response = await getAdminReadingLogs({ eventId });

      if (requestSequence !== requestSequenceRef.current) {
        return;
      }

      setLogs(response.map(toDisplayLog));
      setListError(null);
    } catch (error: unknown) {
      if (requestSequence !== requestSequenceRef.current) {
        return;
      }

      setLogs([]);
      setListError(getApiErrorMessage(error, '독서일지 목록을 불러오지 못했습니다.'));
    } finally {
      if (requestSequence === requestSequenceRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    if (initialRequestRef.current === null) {
      initialRequestRef.current = getAdminEvents().then((nextEvents) => ({
        events: nextEvents,
        eventId: chooseAdminEventId(nextEvents, DEFAULT_EVENT_SELECTION_ORDER),
      }));
    }

    initialRequestRef.current
      .then(({ events: nextEvents, eventId }) => {
        if (!isActive) {
          return;
        }

        setEvents(nextEvents);
        setSelectedEventId(eventId);

        if (eventId === null) {
          setIsLoading(false);
          setListError('관리할 행사가 없습니다.');
        } else {
          void loadLogs(eventId);
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setIsLoading(false);
          setListError(getApiErrorMessage(error, '행사 목록을 불러오지 못했습니다.'));
        }
      });

    return () => {
      isActive = false;
    };
  }, [loadLogs]);

  // 선택한 일지의 최신 상세(이전 승인 누적 등)를 서버에서 다시 받아 패널에 표시합니다.
  useEffect(() => {
    const readingLogId = Number(activeLogId);

    if (activeLogId === null || !Number.isInteger(readingLogId) || readingLogId <= 0) {
      return;
    }

    let isActive = true;

    getAdminReadingLogDetail(readingLogId)
      .then((response) => {
        if (isActive) {
          setDetailState({ logId: activeLogId, log: toDisplayLog(response), error: null });
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setDetailState({
            logId: activeLogId,
            log: null,
            error: getApiErrorMessage(error, '독서일지 상세를 불러오지 못했습니다.'),
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [activeLogId, detailVersion]);

  const selectLog = (logId: string | null) => {
    setSelectedLogId(logId);
    setActionError(null);

    if (logId && window.matchMedia(NARROW_LAYOUT_QUERY).matches) {
      window.requestAnimationFrame(() =>
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    }
  };

  const handleTabChange = (tab: (typeof QUEUE_TABS)[number]) => {
    setStatusFilter(tab.status);
    setReviewFilter(tab.review);
  };

  const handleResetFilters = () => {
    setSearchKeyword('');
    setReviewFilter('ALL');
    setDateFilter('');
  };

  const refreshAfterMutation = async () => {
    if (selectedEventId === null) {
      return;
    }

    const nextLogs = await getAdminReadingLogs({ eventId: selectedEventId });

    setLogs(nextLogs.map(toDisplayLog));
    setDetailVersion((current) => current + 1);
  };

  /**
   * 승인·반려 공통 처리: 서버 요청이 성공한 경우에만 목록을 갱신하고 다음 대기 일지로 이동합니다.
   * 실패하면 현재 일지에 머물며 오류를 패널에 보여 줍니다.
   */
  const runReviewAction = async (
    logId: string,
    request: (readingLogId: number) => Promise<unknown>,
    messages: { success: string; failure: string },
  ) => {
    const readingLogId = Number(logId);

    if (!Number.isInteger(readingLogId) || readingLogId <= 0 || processingLogId !== null) {
      return false;
    }

    const nextPendingId = findNextPendingId(logId);
    const participantName = logs.find((log) => log.id === logId)?.participantName ?? '참가자';

    setProcessingLogId(readingLogId);
    setFeedbackMessage('');
    setActionError(null);

    try {
      await request(readingLogId);
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, messages.failure);
      setFeedbackMessage(message);
      setFeedbackIsError(true);
      setActionError(message);
      setProcessingLogId(null);
      return false;
    }

    try {
      await refreshAfterMutation();
      setFeedbackMessage(`${participantName} 님의 ${messages.success}`);
      setFeedbackIsError(false);
      selectLog(nextPendingId ?? logId);
    } catch (error: unknown) {
      setFeedbackMessage(
        getApiErrorMessage(error, '처리는 완료됐지만 목록을 다시 불러오지 못했습니다.'),
      );
      setFeedbackIsError(true);
    } finally {
      setProcessingLogId(null);
    }

    return true;
  };

  const handleApprove = (logId: string) =>
    runReviewAction(logId, (readingLogId) => approveAdminReadingLog(readingLogId), {
      success: '독서일지를 승인했습니다.',
      failure: '독서일지를 승인하지 못했습니다.',
    });

  const handleReject = (logId: string, reason: string) => {
    const normalizedReason = reason.trim();

    if (!normalizedReason) {
      return Promise.resolve(false);
    }

    return runReviewAction(
      logId,
      (readingLogId) => rejectAdminReadingLog(readingLogId, { reason: normalizedReason }),
      {
        success: '독서일지를 반려했습니다.',
        failure: '독서일지를 반려하지 못했습니다.',
      },
    );
  };

  const handleEventChange = (value: string) => {
    const eventId = Number(value);

    if (!Number.isInteger(eventId) || eventId <= 0) {
      return;
    }

    requestSequenceRef.current += 1;
    setSelectedEventId(eventId);
    setSelectedLogId(null);
    setDetailState(null);
    setFeedbackMessage('');
    void loadLogs(eventId);
  };

  const renderQueue = () => {
    if (isLoading) {
      return (
        <p className="admin-queue__message" role="status">
          독서일지를 불러오는 중입니다.
        </p>
      );
    }

    if (listError) {
      return (
        <p className="admin-queue__message" role="alert">
          {listError}
        </p>
      );
    }

    if (filteredLogs.length === 0) {
      return (
        <p className="admin-queue__message">
          {logs.length === 0
            ? '제출된 독서일지가 없습니다.'
            : statusFilter === 'submit' && !hasActiveFilters
              ? '검토할 독서일지가 없습니다. 모두 처리했습니다.'
              : '조건에 맞는 독서일지가 없습니다.'}
        </p>
      );
    }

    return (
      <ul className="admin-queue__list">
        {filteredLogs.map((log) => {
          const hasWarning = validateReadingLog(log).length > 0;
          const firstBookTitle = log.books[0]?.title ?? '등록 도서 없음';
          const bookLabel =
            log.books.length > 1
              ? `${firstBookTitle} 외 ${log.books.length - 1}권`
              : firstBookTitle;

          return (
            <li key={log.id}>
              <button
                type="button"
                className="admin-queue__item"
                aria-current={log.id === activeLogId ? 'true' : undefined}
                onClick={() => selectLog(log.id)}
              >
                <strong>{log.participantName}</strong>
                <small>
                  {formatKoDateKey(log.readingDate)} · {bookLabel}
                </small>
                <span className="admin-queue__item-side">
                  <span className="admin-queue__pages">
                    {getReadingLogTotalPages(log).toLocaleString('ko-KR')}쪽
                  </span>
                  {hasWarning ? (
                    <span className="admin-reading-log-review admin-reading-log-review--warning">
                      확인 필요
                    </span>
                  ) : (
                    statusFilter !== 'submit' && <ReadingLogStatusBadge status={log.status} />
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <section className="admin-page admin-reading-logs">
      <header className="admin-page__header admin-reading-logs__header">
        <div className="admin-reading-logs__heading">
          <h1>독서일지 검토</h1>
          <p>대기 목록에서 일지를 고르고, 도서 정보와 승인량을 비교한 뒤 승인 또는 반려합니다.</p>
        </div>

        <div className="admin-reading-logs__event-selector">
          <label htmlFor="readingLogEvent">관리 행사</label>
          <select
            id="readingLogEvent"
            value={selectedEventId ?? ''}
            disabled={events.length === 0 || isLoading}
            onChange={(event) => handleEventChange(event.target.value)}
          >
            {events.length === 0 && <option value="">등록된 행사 없음</option>}
            {events.map((event) => (
              <option key={event.eventId} value={event.eventId}>
                {event.roundNo}회 · {event.title}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="admin-reading-logs__tabs">
        <div className="admin-segmented" aria-label="독서일지 상태 필터">
          {QUEUE_TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              aria-pressed={statusFilter === tab.status && reviewFilter === tab.review}
              onClick={() => handleTabChange(tab)}
            >
              {tab.label}
              <b className={tab.review === 'warning' ? 'is-warning' : undefined}>
                {getTabCount(tab)}
              </b>
            </button>
          ))}
        </div>
        <p
          className={['admin-feedback', feedbackIsError ? 'admin-feedback--error' : '']
            .filter(Boolean)
            .join(' ')}
          role={feedbackIsError ? 'alert' : 'status'}
          aria-live="polite"
        >
          {feedbackMessage}
        </p>
      </div>

      <div className="admin-split">
        <section className="admin-queue" aria-labelledby="readingLogQueueTitle">
          <div className="admin-queue__head">
            <h2 id="readingLogQueueTitle">
              목록 <span>{filteredLogs.length.toLocaleString('ko-KR')}건</span>
            </h2>
            <select
              aria-label="정렬"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as QueueSort)}
            >
              <option value="oldest">제출 오래된 순</option>
              <option value="newest">최근 제출 순</option>
            </select>
          </div>
          <div className="admin-queue__tools">
            <input
              type="search"
              value={searchKeyword}
              aria-label="독서일지 검색"
              placeholder="참가자, 학번, 책 제목, 저자, 출판사"
              onChange={(event) => setSearchKeyword(event.target.value)}
            />
            <div className="admin-queue__tools-row">
              <select
                aria-label="자동 검증 상태"
                value={reviewFilter}
                onChange={(event) => setReviewFilter(event.target.value as ReadingLogReviewFilter)}
              >
                {READING_LOG_REVIEW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                aria-label="독서 날짜"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
              />
            </div>
          </div>
          {renderQueue()}
          <div className="admin-queue__footer">
            전체 {logs.length.toLocaleString('ko-KR')}건 중 {filteredLogs.length}건 표시
            {hasActiveFilters && (
              <button
                type="button"
                className="admin-reading-logs__reset"
                onClick={handleResetFilters}
              >
                검색·필터 초기화
              </button>
            )}
          </div>
        </section>

        <div ref={panelRef} className="admin-reading-logs__panel">
          {activeLog ? (
            <ReadingLogReviewPanel
              key={activeLog.id}
              log={activeLog}
              position={{ index: activeIndex, total: filteredLogs.length }}
              hasNextPending={findNextPendingId(activeLog.id) !== null}
              isLoading={isDetailLoading}
              error={actionError ?? activeDetail?.error ?? null}
              isProcessing={processingLogId === Number(activeLog.id)}
              onPrevious={
                activeIndex > 0 ? () => selectLog(filteredLogs[activeIndex - 1].id) : undefined
              }
              onNext={
                activeIndex >= 0 && activeIndex < filteredLogs.length - 1
                  ? () => selectLog(filteredLogs[activeIndex + 1].id)
                  : undefined
              }
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ) : (
            <div className="admin-detail-panel">
              <p className="admin-detail-panel__empty">
                {isLoading
                  ? '독서일지를 불러오는 중입니다.'
                  : '왼쪽 목록에서 검토할 독서일지를 선택하세요.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default AdminReadingLogsPage;
