import { useCallback, useMemo, useRef, useState } from 'react';
import ReadingLogBulkApproveDialog from '../../components/admin/readingLogs/ReadingLogBulkApproveDialog';
import ReadingLogDetailDialog from '../../components/admin/readingLogs/ReadingLogDetailDialog';
import ReadingLogFilters from '../../components/admin/readingLogs/ReadingLogFilters';
import ReadingLogTable from '../../components/admin/readingLogs/ReadingLogTable';
import { ADMIN_READING_LOGS } from '../../mocks/adminReadingLogs';
import {
  validateReadingLog,
  type AdminReadingLog,
  type ReadingLogDialogMode,
  type ReadingLogReviewFilter,
  type ReadingLogStatusFilter,
} from '../../types/adminReadingLog';
import '../../styles/admin-reading-logs.css';

type DialogRequest = {
  logId: string;
  initialMode: ReadingLogDialogMode;
};

function AdminReadingLogsPage() {
  const [logs, setLogs] = useState<AdminReadingLog[]>(() => [
    ...ADMIN_READING_LOGS,
  ]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<ReadingLogStatusFilter>('ALL');
  const [reviewFilter, setReviewFilter] =
    useState<ReadingLogReviewFilter>('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [dialogRequest, setDialogRequest] =
    useState<DialogRequest | null>(null);
  const [isBulkApproveDialogOpen, setIsBulkApproveDialogOpen] =
    useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const dialogOpenerRef = useRef<HTMLElement | null>(null);

  const isLoading = false;
  const error: string | null = null;

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

        return (
          matchesKeyword && matchesStatus && matchesReview && matchesDate
        );
      })
      .sort(
        (firstLog, secondLog) =>
          new Date(secondLog.submittedAt).getTime() -
          new Date(firstLog.submittedAt).getTime(),
      );
  }, [dateFilter, logs, reviewFilter, searchKeyword, statusFilter]);

  const selectedLog = dialogRequest
    ? logs.find((log) => log.id === dialogRequest.logId)
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
    rememberDialogOpener();
    setDialogRequest({ logId, initialMode });
  };

  const restoreDialogOpener = useCallback(() => {
    const dialogOpener = dialogOpenerRef.current;

    window.requestAnimationFrame(() => dialogOpener?.focus());
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogRequest(null);
    restoreDialogOpener();
  }, [restoreDialogOpener]);

  const handleCloseBulkDialog = useCallback(() => {
    setIsBulkApproveDialogOpen(false);
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

  const handleApprove = (logId: string) => {
    const targetLog = logs.find((log) => log.id === logId);

    if (
      !targetLog ||
      targetLog.status !== 'submit' ||
      validateReadingLog(targetLog).length > 0
    ) {
      return;
    }

    setLogs((currentLogs) =>
      currentLogs.map((log) =>
        log.id === logId
          ? {
              ...log,
              status: 'approve',
              approvedAt: new Date().toISOString(),
              rejectionReason: undefined,
            }
          : log,
      ),
    );
    setSelectedLogIds((currentIds) =>
      currentIds.filter((id) => id !== logId),
    );
    setFeedbackMessage(
      `${targetLog.participantName}님의 ${targetLog.readingDate} 독서일지를 승인했습니다.`,
    );
  };

  const handleReject = (logId: string, reason: string) => {
    const targetLog = logs.find((log) => log.id === logId);
    const normalizedReason = reason.trim();

    if (
      !targetLog ||
      targetLog.status !== 'submit' ||
      !normalizedReason
    ) {
      return;
    }

    setLogs((currentLogs) =>
      currentLogs.map((log) =>
        log.id === logId
          ? {
              ...log,
              status: 'rejected',
              rejectionReason: normalizedReason,
            }
          : log,
      ),
    );
    setSelectedLogIds((currentIds) =>
      currentIds.filter((id) => id !== logId),
    );
    setFeedbackMessage(
      `${targetLog.participantName}님의 ${targetLog.readingDate} 독서일지를 반려했습니다.`,
    );
  };

  const handleOpenBulkApproveDialog = () => {
    if (selectedLogIds.length === 0) {
      return;
    }

    rememberDialogOpener();
    setIsBulkApproveDialogOpen(true);
  };

  const handleBulkApprove = () => {
    const eligibleSelectedIds = new Set(
      logs
        .filter(
          (log) =>
            selectedLogIds.includes(log.id) &&
            log.status === 'submit' &&
            validateReadingLog(log).length === 0,
        )
        .map((log) => log.id),
    );

    if (eligibleSelectedIds.size === 0) {
      handleCloseBulkDialog();
      return;
    }

    const approvedAt = new Date().toISOString();

    setLogs((currentLogs) =>
      currentLogs.map((log) =>
        eligibleSelectedIds.has(log.id)
          ? {
              ...log,
              status: 'approve',
              approvedAt,
              rejectionReason: undefined,
            }
          : log,
      ),
    );
    setSelectedLogIds([]);
    setFeedbackMessage(
      `선택한 독서일지 ${eligibleSelectedIds.size}건을 승인했습니다.`,
    );
    handleCloseBulkDialog();
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

        <div
          className="admin-reading-logs__summary"
          aria-label="독서일지 검토 현황"
        >
          <button
            type="button"
            aria-pressed={
              statusFilter === 'ALL' && reviewFilter === 'ALL'
            }
            onClick={() => handleSummaryFilter('ALL', 'ALL')}
          >
            <span>전체</span>
            <strong>{statistics.total}</strong>
          </button>
          <button
            type="button"
            aria-pressed={
              statusFilter === 'submit' && reviewFilter === 'ALL'
            }
            onClick={() => handleSummaryFilter('submit', 'ALL')}
          >
            <span>제출</span>
            <strong>{statistics.submit}</strong>
          </button>
          <button
            type="button"
            aria-pressed={
              statusFilter === 'approve' && reviewFilter === 'ALL'
            }
            onClick={() => handleSummaryFilter('approve', 'ALL')}
          >
            <span>승인</span>
            <strong>{statistics.approve}</strong>
          </button>
          <button
            type="button"
            aria-pressed={
              statusFilter === 'rejected' && reviewFilter === 'ALL'
            }
            onClick={() => handleSummaryFilter('rejected', 'ALL')}
          >
            <span>반려</span>
            <strong>{statistics.rejected}</strong>
          </button>
          <button
            type="button"
            className="admin-reading-logs__summary-warning"
            aria-pressed={
              statusFilter === 'ALL' && reviewFilter === 'warning'
            }
            onClick={() => handleSummaryFilter('ALL', 'warning')}
          >
            <span>확인 필요</span>
            <strong>{statistics.warning}</strong>
          </button>
        </div>
      </header>

      <aside className="admin-reading-logs__policy" aria-label="검토 정책 안내">
        <strong>검토 정책</strong>
        <span>하루 최대 400쪽</span>
        <span>한 일지에 여러 권 기록 가능</span>
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
          className="admin-reading-logs__feedback"
          role="status"
          aria-live="polite"
        >
          {feedbackMessage}
        </div>
        <button
          type="button"
          className="admin-reading-logs__button admin-reading-logs__button--primary"
          disabled={selectedLogIds.length === 0}
          onClick={handleOpenBulkApproveDialog}
        >
          일괄 승인 ({selectedLogIds.length}건)
        </button>
      </div>

      <ReadingLogTable
        logs={filteredLogs}
        hasLogs={logs.length > 0}
        isLoading={isLoading}
        error={error}
        selectedLogIds={selectedLogIds}
        onToggleLog={handleToggleLog}
        onToggleAll={handleToggleAll}
        onOpenDialog={handleOpenDialog}
      />

      {selectedLog && dialogRequest && (
        <ReadingLogDetailDialog
          log={selectedLog}
          initialMode={dialogRequest.initialMode}
          onClose={handleCloseDialog}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {isBulkApproveDialogOpen && (
        <ReadingLogBulkApproveDialog
          selectedCount={selectedLogIds.length}
          onClose={handleCloseBulkDialog}
          onConfirm={handleBulkApprove}
        />
      )}
    </section>
  );
}

export default AdminReadingLogsPage;
