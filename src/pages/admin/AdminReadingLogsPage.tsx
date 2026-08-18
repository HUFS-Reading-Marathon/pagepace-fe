import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  approveAdminReadingLog,
  getAdminReadingLogDetail,
  getAdminReadingLogs,
  rejectAdminReadingLog,
} from '../../api/adminReadingLogApi';
import { ApiError } from '../../api/apiClient';
import { getAdminEvents } from '../../api/adminEventApi';
import ReadingLogDetailDialog from '../../components/admin/readingLogs/ReadingLogDetailDialog';
import ReadingLogFilters from '../../components/admin/readingLogs/ReadingLogFilters';
import ReadingLogTable from '../../components/admin/readingLogs/ReadingLogTable';
import type { AdminEvent } from '../../types/adminEvent';
import {
  validateReadingLog,
  type AdminReadingLog,
  type ReadingLogDialogMode,
  type ReadingLogReviewFilter,
  type ReadingLogStatus,
  type ReadingLogStatusFilter,
} from '../../types/adminReadingLog';
import type {
  AdminReadingLogResponse,
  AdminReadingLogStatus,
} from '../../types/adminReadingLogApi';
import '../../styles/admin-reading-logs.css';

type DialogRequest = {
  readingLogId: number;
  initialMode: ReadingLogDialogMode;
};

const STATUS_MAP: Record<AdminReadingLogStatus, ReadingLogStatus> = {
  SUBMITTED: 'submit',
  APPROVED: 'approve',
  REJECTED: 'rejected',
};

const DEFAULT_EVENT_SELECTION_ORDER = [
  'APPLICATION_OPEN',
  'READY',
  'IN_PROGRESS',
  'DRAFT',
] as const;

function getApiErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function chooseEventId(events: AdminEvent[]) {
  for (const status of DEFAULT_EVENT_SELECTION_ORDER) {
    const matchedEvent = events.find((event) => event.status === status);

    if (matchedEvent) {
      return matchedEvent.eventId;
    }
  }

  return events[0]?.eventId ?? null;
}

function toDisplayLog(log: AdminReadingLogResponse): AdminReadingLog {
  const sortedBooks = [...log.books].sort(
    (first, second) => first.displayOrder - second.displayOrder,
  );

  return {
    id: String(log.readingLogId),
    participantId: String(log.participationId),
    participantName: log.userName || '-',
    studentNumber: log.studentNo || '-',
    readingDate: log.readingDate,
    submittedAt: log.createdAt,
    status: STATUS_MAP[log.status],
    approvedAt: log.reviewedAt || undefined,
    rejectionReason:
      log.status === 'REJECTED' ? log.adminComment || undefined : undefined,
    adminMemo: log.adminComment || undefined,
    totalReadPages: log.totalReadPages,
    convertedDistanceMeter: log.convertedDistanceMeter,
    eventTitle: log.eventTitle,
    courseName: log.courseName,
    recommendedRejectReasons: log.recommendedRejectReasons ?? [],
    books: sortedBooks.map((book) => ({
      id: String(book.readingLogBookId),
      bookId: String(book.readingLogBookId),
      title: book.bookTitle || '-',
      author: book.author || '-',
      publisher: book.publisher || '-',
      totalPages: book.totalBookPages,
      previouslyApprovedPages: book.existingApprovedReadPages,
      readPages: book.submittedReadPages,
      expectedApprovedPages: book.expectedApprovedReadPages,
      remainingPagesAfterApproval: book.remainingPagesAfterApproval,
      completedAfterApproval: book.completedAfterApproval,
      pageExceeded: book.pageExceeded,
      warningMessage: book.warningMessage,
    })),
  };
}

function AdminReadingLogsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [logs, setLogs] = useState<AdminReadingLog[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<ReadingLogStatusFilter>('ALL');
  const [reviewFilter, setReviewFilter] =
    useState<ReadingLogReviewFilter>('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [dialogRequest, setDialogRequest] =
    useState<DialogRequest | null>(null);
  const [detailLog, setDetailLog] = useState<AdminReadingLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [processingLogId, setProcessingLogId] = useState<number | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const initialRequestRef = useRef<
    Promise<{ events: AdminEvent[]; eventId: number | null }> | null
  >(null);
  const requestSequenceRef = useRef(0);
  const detailRequestSequenceRef = useRef(0);
  const dialogOpenerRef = useRef<HTMLElement | null>(null);

  const statistics = useMemo(() => {
    const approvedLogs = logs.filter((log) => log.status === 'approve');

    return {
      total: logs.length,
      submit: logs.filter((log) => log.status === 'submit').length,
      approve: approvedLogs.length,
      rejected: logs.filter((log) => log.status === 'rejected').length,
      warning: logs.filter((log) => validateReadingLog(log).length > 0)
        .length,
    };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();

    return logs
      .filter((log) => {
        const searchableValues = [
          log.participantName,
          log.studentNumber,
          log.courseName ?? '',
          ...log.books.flatMap((book) => [
            book.title,
            book.author,
            book.publisher,
          ]),
        ];
        const matchesKeyword =
          !normalizedKeyword ||
          searchableValues.some((value) =>
            value.toLowerCase().includes(normalizedKeyword),
          );
        const matchesStatus =
          statusFilter === 'ALL' || log.status === statusFilter;
        const hasWarning = validateReadingLog(log).length > 0;
        const matchesReview =
          reviewFilter === 'ALL' ||
          (reviewFilter === 'warning' ? hasWarning : !hasWarning);
        const matchesDate = !dateFilter || log.readingDate === dateFilter;

        return matchesKeyword && matchesStatus && matchesReview && matchesDate;
      })
      .sort(
        (firstLog, secondLog) =>
          new Date(secondLog.submittedAt).getTime() -
          new Date(firstLog.submittedAt).getTime(),
      );
  }, [dateFilter, logs, reviewFilter, searchKeyword, statusFilter]);

  const selectedLog = dialogRequest
    ? detailLog ??
      logs.find((log) => log.id === String(dialogRequest.readingLogId))
    : undefined;

  const visibleEligibleLogIds = useMemo(
    () =>
      filteredLogs
        .filter(
          (log) =>
            log.status === 'submit' && validateReadingLog(log).length === 0,
        )
        .map((log) => log.id),
    [filteredLogs],
  );

  const replaceLogs = (response: AdminReadingLogResponse[]) => {
    setLogs(response.map(toDisplayLog));
    const validIds = new Set(response.map((log) => String(log.readingLogId)));
    setSelectedLogIds((current) =>
      current.filter((readingLogId) => validIds.has(readingLogId)),
    );
  };

  const loadLogs = useCallback(async (eventId: number) => {
    const requestSequence = ++requestSequenceRef.current;
    setIsLoading(true);

    try {
      const response = await getAdminReadingLogs({ eventId });

      if (requestSequence !== requestSequenceRef.current) {
        return;
      }

      replaceLogs(response);
      setListError(null);
    } catch (error: unknown) {
      if (requestSequence !== requestSequenceRef.current) {
        return;
      }

      setLogs([]);
      setListError(
        getApiErrorMessage(error, '독서일지 목록을 불러오지 못했습니다.'),
      );
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
        eventId: chooseEventId(nextEvents),
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
          setListError(
            getApiErrorMessage(error, '행사 목록을 불러오지 못했습니다.'),
          );
        }
      });

    return () => {
      isActive = false;
    };
  }, [loadLogs]);

  const clearSelectionAnd = (updateFilter: () => void) => {
    setSelectedLogIds([]);
    updateFilter();
  };

  const handleSummaryFilter = (
    nextStatusFilter: ReadingLogStatusFilter,
    nextReviewFilter: ReadingLogReviewFilter,
  ) => {
    setSelectedLogIds([]);
    setStatusFilter(nextStatusFilter);
    setReviewFilter(nextReviewFilter);
  };

  const handleResetFilters = () => {
    setSearchKeyword('');
    setStatusFilter('ALL');
    setReviewFilter('ALL');
    setDateFilter('');
    setSelectedLogIds([]);
  };

  const rememberDialogOpener = () => {
    dialogOpenerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  };

  const handleOpenDialog = (
    logId: string,
    initialMode: ReadingLogDialogMode,
  ) => {
    const readingLogId = Number(logId);

    if (!Number.isInteger(readingLogId) || readingLogId <= 0) {
      return;
    }

    rememberDialogOpener();
    setDialogRequest({ readingLogId, initialMode });
    setDetailLog(logs.find((log) => log.id === logId) ?? null);
    setDetailError(null);
    setIsDetailLoading(true);
    const requestSequence = ++detailRequestSequenceRef.current;

    getAdminReadingLogDetail(readingLogId)
      .then((response) => {
        if (requestSequence === detailRequestSequenceRef.current) {
          setDetailLog(toDisplayLog(response));
        }
      })
      .catch((error: unknown) => {
        if (requestSequence === detailRequestSequenceRef.current) {
          setDetailError(
            getApiErrorMessage(
              error,
              '독서일지 상세를 불러오지 못했습니다.',
            ),
          );
        }
      })
      .finally(() => {
        if (requestSequence === detailRequestSequenceRef.current) {
          setIsDetailLoading(false);
        }
      });
  };

  const restoreDialogOpener = useCallback(() => {
    const dialogOpener = dialogOpenerRef.current;
    window.requestAnimationFrame(() => dialogOpener?.focus());
  }, []);

  const handleCloseDialog = useCallback(() => {
    detailRequestSequenceRef.current += 1;
    setDialogRequest(null);
    setDetailLog(null);
    setDetailError(null);
    restoreDialogOpener();
  }, [restoreDialogOpener]);

  const handleToggleLog = (logId: string, checked: boolean) => {
    const targetLog = logs.find((log) => log.id === logId);
    const isEligible =
      targetLog?.status === 'submit' &&
      validateReadingLog(targetLog).length === 0;

    if (!isEligible) {
      return;
    }

    setSelectedLogIds((currentIds) =>
      checked
        ? [...new Set([...currentIds, logId])]
        : currentIds.filter((id) => id !== logId),
    );
  };

  const handleToggleAll = (checked: boolean) => {
    setSelectedLogIds(checked ? visibleEligibleLogIds : []);
  };

  const refreshAfterMutation = async (readingLogId: number) => {
    if (selectedEventId === null) {
      return;
    }

    const [nextLogs, nextDetail] = await Promise.all([
      getAdminReadingLogs({ eventId: selectedEventId }),
      dialogRequest?.readingLogId === readingLogId
        ? getAdminReadingLogDetail(readingLogId)
        : Promise.resolve(null),
    ]);

    replaceLogs(nextLogs);

    if (nextDetail) {
      setDetailLog(toDisplayLog(nextDetail));
    }
  };

  const handleApprove = async (logId: string) => {
    const readingLogId = Number(logId);

    if (
      !Number.isInteger(readingLogId) ||
      readingLogId <= 0 ||
      processingLogId !== null
    ) {
      return false;
    }

    setProcessingLogId(readingLogId);
    setFeedbackMessage('');
    setDetailError(null);

    try {
      await approveAdminReadingLog(readingLogId);
      await refreshAfterMutation(readingLogId);
      setSelectedLogIds((current) =>
        current.filter((id) => id !== logId),
      );
      setFeedbackMessage('독서일지를 승인했습니다.');
      setFeedbackIsError(false);
      return true;
    } catch (error: unknown) {
      const message = getApiErrorMessage(
        error,
        '독서일지를 승인하지 못했습니다.',
      );
      setFeedbackMessage(message);
      setFeedbackIsError(true);
      setDetailError(message);
      return false;
    } finally {
      setProcessingLogId(null);
    }
  };

  const handleReject = async (logId: string, reason: string) => {
    const readingLogId = Number(logId);
    const normalizedReason = reason.trim();

    if (
      !Number.isInteger(readingLogId) ||
      readingLogId <= 0 ||
      !normalizedReason ||
      processingLogId !== null
    ) {
      return false;
    }

    setProcessingLogId(readingLogId);
    setFeedbackMessage('');
    setDetailError(null);

    try {
      await rejectAdminReadingLog(readingLogId, {
        reason: normalizedReason,
      });
      await refreshAfterMutation(readingLogId);
      setSelectedLogIds((current) =>
        current.filter((id) => id !== logId),
      );
      setFeedbackMessage('독서일지를 반려했습니다.');
      setFeedbackIsError(false);
      return true;
    } catch (error: unknown) {
      const message = getApiErrorMessage(
        error,
        '독서일지를 반려하지 못했습니다.',
      );
      setFeedbackMessage(message);
      setFeedbackIsError(true);
      setDetailError(message);
      return false;
    } finally {
      setProcessingLogId(null);
    }
  };

  const handleEventChange = (value: string) => {
    const eventId = Number(value);

    if (!Number.isInteger(eventId) || eventId <= 0) {
      return;
    }

    requestSequenceRef.current += 1;
    setSelectedEventId(eventId);
    setSelectedLogIds([]);
    setDialogRequest(null);
    detailRequestSequenceRef.current += 1;
    setDetailLog(null);
    setFeedbackMessage('');
    void loadLogs(eventId);
  };

  return (
    <section className="admin-page admin-reading-logs">
      <header className="admin-page__header admin-reading-logs__header">
        <div className="admin-reading-logs__heading">
          <h1>독서일지 검토</h1>
          <p>
            제출된 독서일지의 도서 정보와 독서량을 확인하고 승인 또는
            반려합니다.
          </p>
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

        <div
          className="admin-reading-logs__summary"
          aria-label="독서일지 검토 현황"
        >
          {[
            ['ALL', 'ALL', '전체', statistics.total],
            ['submit', 'ALL', '제출', statistics.submit],
            ['approve', 'ALL', '승인', statistics.approve],
            ['rejected', 'ALL', '반려', statistics.rejected],
            ['ALL', 'warning', '확인 필요', statistics.warning],
          ].map(([status, review, label, count]) => (
            <button
              key={`${status}-${review}`}
              type="button"
              className={review === 'warning' ? 'admin-reading-logs__summary-warning' : undefined}
              aria-pressed={statusFilter === status && reviewFilter === review}
              onClick={() =>
                handleSummaryFilter(
                  status as ReadingLogStatusFilter,
                  review as ReadingLogReviewFilter,
                )
              }
            >
              <span>{label}</span>
              <strong>{count}</strong>
            </button>
          ))}
        </div>
      </header>

      <aside className="admin-reading-logs__policy" aria-label="검토 정책 안내">
        <strong>검토 정책</strong>
        <span>서버 검증 결과 우선</span>
        <span>승인 기록만 누적 거리·순위에 반영</span>
        <span>반려 기록은 참가자가 수정 후 재제출 가능</span>
      </aside>

      <ReadingLogFilters
        searchKeyword={searchKeyword}
        statusFilter={statusFilter}
        reviewFilter={reviewFilter}
        dateFilter={dateFilter}
        resultCount={filteredLogs.length}
        totalCount={logs.length}
        onSearchKeywordChange={(value) =>
          clearSelectionAnd(() => setSearchKeyword(value))
        }
        onStatusFilterChange={(value) =>
          clearSelectionAnd(() => setStatusFilter(value))
        }
        onReviewFilterChange={(value) =>
          clearSelectionAnd(() => setReviewFilter(value))
        }
        onDateFilterChange={(value) =>
          clearSelectionAnd(() => setDateFilter(value))
        }
        onReset={handleResetFilters}
      />

      <div className="admin-reading-logs__bulk-actions">
        <div
          className={[
            'admin-reading-logs__feedback',
            feedbackIsError ? 'admin-reading-logs__feedback--error' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          role={feedbackIsError ? 'alert' : 'status'}
          aria-live="polite"
        >
          {feedbackMessage ||
            (selectedLogIds.length > 0
              ? '일괄 승인 API가 확인되지 않아 단건 검토만 가능합니다.'
              : '')}
        </div>
        <button
          type="button"
          className="admin-reading-logs__button admin-reading-logs__button--primary"
          disabled
          title="일괄 승인 API 확인 필요"
        >
          일괄 승인 ({selectedLogIds.length}건)
        </button>
      </div>

      <ReadingLogTable
        logs={filteredLogs}
        hasLogs={logs.length > 0}
        isLoading={isLoading}
        error={listError}
        processingLogId={processingLogId ? String(processingLogId) : null}
        selectedLogIds={selectedLogIds}
        onToggleLog={handleToggleLog}
        onToggleAll={handleToggleAll}
        onOpenDialog={handleOpenDialog}
      />

      {selectedLog && dialogRequest && (
        <ReadingLogDetailDialog
          key={dialogRequest.readingLogId}
          log={selectedLog}
          initialMode={dialogRequest.initialMode}
          isLoading={isDetailLoading}
          error={detailError}
          isProcessing={processingLogId === dialogRequest.readingLogId}
          onClose={handleCloseDialog}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </section>
  );
}

export default AdminReadingLogsPage;
