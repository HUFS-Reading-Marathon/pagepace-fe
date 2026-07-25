import { useEffect, useRef } from 'react';
import {
  formatReadingDistance,
  formatReadingLogDate,
  formatReadingLogDateTime,
  getReadingDistanceMeters,
  getReadingLogTotalPages,
  validateReadingLog,
  type AdminReadingLog,
  type ReadingLogDialogMode,
} from '../../../types/adminReadingLog';
import ReadingLogStatusBadge from './ReadingLogStatusBadge';

type ReadingLogTableProps = {
  logs: AdminReadingLog[];
  hasLogs: boolean;
  isLoading: boolean;
  error: string | null;
  selectedLogIds: string[];
  onToggleLog: (logId: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onOpenDialog: (
    logId: string,
    initialMode: ReadingLogDialogMode,
  ) => void;
};

function ReadingLogTable({
  logs,
  hasLogs,
  isLoading,
  error,
  selectedLogIds,
  onToggleLog,
  onToggleAll,
  onOpenDialog,
}: ReadingLogTableProps) {
  const selectAllRef = useRef<HTMLInputElement>(null);
  const eligibleLogs = logs.filter(
    (log) => log.status === 'submit' && validateReadingLog(log).length === 0,
  );
  const selectedEligibleCount = eligibleLogs.filter((log) =>
    selectedLogIds.includes(log.id),
  ).length;
  const allEligibleSelected =
    eligibleLogs.length > 0 && selectedEligibleCount === eligibleLogs.length;
  const someEligibleSelected =
    selectedEligibleCount > 0 && !allEligibleSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someEligibleSelected;
    }
  }, [someEligibleSelected]);

  if (isLoading) {
    return (
      <div className="admin-reading-logs__empty" role="status">
        독서일지를 불러오는 중입니다.
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-reading-logs__empty" role="alert">
        독서일지를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </div>
    );
  }

  if (!hasLogs) {
    return (
      <div className="admin-reading-logs__empty">
        등록된 독서일지가 없습니다.
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="admin-reading-logs__empty">
        조건에 맞는 독서일지가 없습니다.
      </div>
    );
  }

  return (
    <div className="admin-reading-logs__table-wrapper">
      <table className="admin-reading-logs__table">
        <thead>
          <tr>
            <th scope="col" className="admin-reading-logs__checkbox-cell">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allEligibleSelected}
                disabled={eligibleLogs.length === 0}
                aria-label="현재 검색 결과의 승인 가능한 제출 일지 전체 선택"
                onChange={(event) => onToggleAll(event.target.checked)}
              />
            </th>
            <th scope="col">상태</th>
            <th scope="col">독서 날짜</th>
            <th scope="col">참가자</th>
            <th scope="col">학번</th>
            <th scope="col">책</th>
            <th scope="col">권수</th>
            <th scope="col">읽은 쪽</th>
            <th scope="col">거리</th>
            <th scope="col">검토 상태</th>
            <th scope="col">제출 시각</th>
            <th scope="col">관리</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const validationIssues = validateReadingLog(log);
            const totalReadPages = getReadingLogTotalPages(log);
            const isSelectable =
              log.status === 'submit' && validationIssues.length === 0;
            const firstBookTitle = log.books[0]?.title ?? '등록 도서 없음';
            const bookLabel =
              log.books.length > 1
                ? `${firstBookTitle} 외 ${log.books.length - 1}권`
                : firstBookTitle;

            return (
              <tr key={log.id}>
                <td className="admin-reading-logs__checkbox-cell">
                  <input
                    type="checkbox"
                    checked={selectedLogIds.includes(log.id)}
                    disabled={!isSelectable}
                    aria-label={`${log.participantName}의 ${formatReadingLogDate(
                      log.readingDate,
                    )} 독서일지 선택`}
                    title={
                      validationIssues.length > 0
                        ? '자동 검증 문제가 있어 일괄 승인할 수 없습니다.'
                        : undefined
                    }
                    onChange={(event) =>
                      onToggleLog(log.id, event.target.checked)
                    }
                  />
                </td>
                <td>
                  <ReadingLogStatusBadge status={log.status} />
                </td>
                <td className="admin-reading-logs__nowrap">
                  {formatReadingLogDate(log.readingDate)}
                </td>
                <td className="admin-reading-logs__participant">
                  {log.participantName}
                </td>
                <td className="admin-reading-logs__nowrap">
                  {log.studentNumber}
                </td>
                <td className="admin-reading-logs__book-title">{bookLabel}</td>
                <td className="admin-reading-logs__number">
                  {log.books.length}권
                </td>
                <td className="admin-reading-logs__number">
                  {totalReadPages.toLocaleString('ko-KR')}쪽
                </td>
                <td className="admin-reading-logs__nowrap">
                  {formatReadingDistance(
                    getReadingDistanceMeters(totalReadPages),
                  )}
                </td>
                <td>
                  {validationIssues.length > 0 ? (
                    <span
                      className="admin-reading-log-review admin-reading-log-review--warning"
                      title={`자동 검증 문제 ${validationIssues.length}건`}
                    >
                      확인 필요
                    </span>
                  ) : (
                    <span className="admin-reading-log-review admin-reading-log-review--safe">
                      자동 검증 이상 없음
                    </span>
                  )}
                </td>
                <td className="admin-reading-logs__submitted-at">
                  {formatReadingLogDateTime(log.submittedAt)}
                </td>
                <td>
                  <div className="admin-reading-logs__row-actions">
                    <button
                      type="button"
                      className="admin-reading-logs__table-button"
                      onClick={() => onOpenDialog(log.id, 'detail')}
                    >
                      {log.status === 'submit' ? '상세 검토' : '상세 보기'}
                    </button>
                    {log.status === 'submit' && (
                      <>
                        <button
                          type="button"
                          className="admin-reading-logs__table-button admin-reading-logs__table-button--approve"
                          disabled={validationIssues.length > 0}
                          title={
                            validationIssues.length > 0
                              ? '자동 검증 문제를 먼저 확인해 주세요.'
                              : undefined
                          }
                          onClick={() =>
                            onOpenDialog(log.id, 'approve-confirm')
                          }
                        >
                          승인
                        </button>
                        <button
                          type="button"
                          className="admin-reading-logs__table-button admin-reading-logs__table-button--reject"
                          onClick={() => onOpenDialog(log.id, 'reject')}
                        >
                          반려
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ReadingLogTable;
