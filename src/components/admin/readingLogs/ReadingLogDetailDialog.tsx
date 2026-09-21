import { useRef, useState } from 'react';
import { DAILY_READING_PAGE_LIMIT } from '../../../constants/reading';
import { useModalDialog } from '../../../hooks/useModalDialog';
import {
  formatReadingDistance,
  getReadingDistanceMeters,
  getReadingLogTotalPages,
  validateReadingLog,
  type AdminReadingLog,
  type ReadingLogDialogMode,
} from '../../../types/adminReadingLog';
import { formatKoDateKey, formatKoDateTime24 } from '../../../utils/date';
import ReadingLogBookDetails from './ReadingLogBookDetails';
import ReadingLogRejectForm from './ReadingLogRejectForm';
import ReadingLogStatusBadge from './ReadingLogStatusBadge';

type ReadingLogDetailDialogProps = {
  log: AdminReadingLog;
  initialMode: ReadingLogDialogMode;
  isLoading?: boolean;
  error?: string | null;
  isProcessing?: boolean;
  onClose: () => void;
  onApprove: (logId: string) => Promise<boolean>;
  onReject: (logId: string, reason: string) => Promise<boolean>;
};

function ReadingLogDetailDialog({
  log,
  initialMode,
  isLoading = false,
  error = null,
  isProcessing = false,
  onClose,
  onApprove,
  onReject,
}: ReadingLogDetailDialogProps) {
  const [mode, setMode] = useState<ReadingLogDialogMode>(initialMode);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const totalReadPages = getReadingLogTotalPages(log);
  const distanceMeters = getReadingDistanceMeters(totalReadPages);
  const validationIssues = validateReadingLog(log);
  const hasValidationIssue = validationIssues.length > 0;
  const { handleBackdropMouseDown } = useModalDialog({
    onClose,
    initialFocusRef: closeButtonRef,
  });

  const dialogTitle =
    mode === 'approve-confirm'
      ? '독서일지 승인 확인'
      : mode === 'reject'
        ? '독서일지 반려'
        : '독서일지 상세 검토';

  const renderDetailActions = () => {
    if (log.status !== 'submit') {
      return (
        <button
          type="button"
          className="admin-reading-log-dialog__button"
          onClick={onClose}
        >
          닫기
        </button>
      );
    }

    return (
      <>
        <button
          type="button"
          className="admin-reading-log-dialog__button admin-reading-log-dialog__button--primary"
          disabled={hasValidationIssue || isProcessing}
          title={
            hasValidationIssue
              ? '자동 검증 문제를 먼저 확인해 주세요.'
              : undefined
          }
          onClick={() => setMode('approve-confirm')}
        >
          승인
        </button>
        <button
          type="button"
          className="admin-reading-log-dialog__button admin-reading-log-dialog__button--danger"
          disabled={isProcessing}
          onClick={() => setMode('reject')}
        >
          반려
        </button>
        <button
          type="button"
          className="admin-reading-log-dialog__button"
          onClick={onClose}
        >
          닫기
        </button>
      </>
    );
  };

  return (
    <div
      className="admin-reading-log-dialog__backdrop"
      onMouseDown={handleBackdropMouseDown}
    >
      <section
        className="admin-reading-log-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="readingLogDialogTitle"
      >
        <header className="admin-reading-log-dialog__header">
          <div>
            <p className="admin-reading-log-dialog__eyebrow">
              {formatKoDateKey(log.readingDate)} · {log.participantName}
            </p>
            <div className="admin-reading-log-dialog__title-row">
              <h2 id="readingLogDialogTitle">{dialogTitle}</h2>
              <ReadingLogStatusBadge status={log.status} />
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="admin-reading-log-dialog__close"
            aria-label="독서일지 상세 창 닫기"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {mode === 'reject' ? (
          <ReadingLogRejectForm
            recommendedReasons={log.recommendedRejectReasons ?? []}
            error={error}
            isProcessing={isProcessing}
            onSubmit={(reason) => onReject(log.id, reason)}
            onSuccess={() => setMode('detail')}
            onBack={() => setMode('detail')}
          />
        ) : (
          <>
            <div className="admin-reading-log-dialog__content">
              {isLoading && (
                <p className="admin-reading-log-dialog__notice" role="status">
                  독서일지 상세를 불러오는 중입니다.
                </p>
              )}
              {error && (
                <p className="admin-reading-log-dialog__error" role="alert">
                  {error}
                </p>
              )}
              {mode === 'approve-confirm' && (
                <section className="admin-reading-log-dialog__section">
                  <h3>이 독서일지를 승인하시겠습니까?</h3>
                  <p className="admin-reading-log-dialog__confirm-message">
                    총 <strong>{totalReadPages.toLocaleString('ko-KR')}쪽</strong>
                    ,{' '}
                    <strong>{formatReadingDistance(distanceMeters)}</strong>,{' '}
                    <strong>{log.books.length}권</strong>의 기록입니다.
                  </p>
                  <div className="admin-reading-log-dialog__warning">
                    자동 검증은 실제 책의 전체 페이지 수와 제외 도서 여부를
                    확인할 수 없습니다. 외부 검색 결과를 직접 확인한 뒤
                    승인해 주세요.
                  </div>
                </section>
              )}

              <section className="admin-reading-log-dialog__section">
                <h3>제출 정보</h3>
                <dl className="admin-reading-log-dialog__details">
                  <div>
                    <dt>참가자</dt>
                    <dd>{log.participantName}</dd>
                  </div>
                  <div>
                    <dt>학번</dt>
                    <dd>{log.studentNumber}</dd>
                  </div>
                  <div>
                    <dt>독서 날짜</dt>
                    <dd>{formatKoDateKey(log.readingDate)}</dd>
                  </div>
                  {log.eventTitle && (
                    <div>
                      <dt>행사</dt>
                      <dd>{log.eventTitle}</dd>
                    </div>
                  )}
                  {log.courseName && (
                    <div>
                      <dt>코스</dt>
                      <dd>{log.courseName}</dd>
                    </div>
                  )}
                  <div>
                    <dt>제출 시각</dt>
                    <dd>{formatKoDateTime24(log.submittedAt)}</dd>
                  </div>
                  {log.approvedAt && (
                  <div>
                    <dt>검토 시각</dt>
                    <dd>{formatKoDateTime24(log.approvedAt)}</dd>
                  </div>
                )}
                </dl>
              </section>

              <section className="admin-reading-log-dialog__section">
                <h3>하루 합계</h3>
                <dl className="admin-reading-log-dialog__summary">
                  <div>
                    <dt>책</dt>
                    <dd>{log.books.length}권</dd>
                  </div>
                  <div>
                    <dt>읽은 쪽</dt>
                    <dd>{totalReadPages.toLocaleString('ko-KR')}쪽</dd>
                  </div>
                  <div>
                    <dt>환산 거리</dt>
                    <dd>
                      {formatReadingDistance(
                        log.convertedDistanceMeter ?? distanceMeters,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>일일 제한</dt>
                    <dd>{DAILY_READING_PAGE_LIMIT}쪽</dd>
                  </div>
                </dl>
                <p className="admin-reading-log-dialog__inclusion-note">
                  {log.status === 'approve'
                    ? '승인된 페이지와 거리만 누적 집계와 순위에 포함됩니다.'
                    : '현재 상태에서는 이 페이지와 거리가 누적 집계와 순위에 포함되지 않습니다.'}
                </p>
              </section>

              {validationIssues.length > 0 ? (
                <section className="admin-reading-log-dialog__section">
                  <h3>자동 검증 결과</h3>
                  <ul className="admin-reading-log-dialog__issue-list admin-reading-log-dialog__issue-list--summary">
                    {validationIssues
                      .filter((issue) => !issue.bookEntryId)
                      .map((issue) => (
                        <li key={`${issue.code}-${issue.detail}`}>
                          <strong>{issue.label}</strong> — {issue.detail}
                        </li>
                      ))}
                    {validationIssues.every((issue) => issue.bookEntryId) && (
                      <li>책별 경고는 아래 독서 내역에서 확인해 주세요.</li>
                    )}
                  </ul>
                </section>
              ) : (
                <div className="admin-reading-log-dialog__safe-note">
                  자동 검증에서 형식·합계·누적 초과 문제는 발견되지 않았습니다.
                  실제 도서 정보가 정확하다는 의미는 아닙니다.
                </div>
              )}

              <ReadingLogBookDetails
                books={log.books}
                validationIssues={validationIssues}
              />

              <div className="admin-reading-log-dialog__manual-check">
                <strong>관리자 직접 확인 필요</strong>
                <p>
                  실제 책 전체 페이지 수와 책 제목·저자·출판사가 일치하는지
                  검색해 주세요. 만화, 전공서적, 수험서·문제집, 원서,
                  정기간행물은 제외 도서입니다.
                </p>
              </div>

              {log.status === 'rejected' && log.rejectionReason && (
                <section className="admin-reading-log-dialog__section">
                  <h3>반려 사유</h3>
                  <div className="admin-reading-log-dialog__rejection-reason">
                    {log.rejectionReason}
                  </div>
                  <p className="admin-reading-log-dialog__mode-description">
                    참가자는 이 사유를 확인한 뒤 기록을 수정해 다시 제출할 수
                    있습니다.
                  </p>
                </section>
              )}
            </div>

            <footer className="admin-reading-log-dialog__actions">
              {mode === 'approve-confirm' ? (
                <>
                  <button
                    type="button"
                    className="admin-reading-log-dialog__button admin-reading-log-dialog__button--primary"
                    disabled={hasValidationIssue || isProcessing}
                    onClick={async () => {
                      const succeeded = await onApprove(log.id);

                      if (succeeded) {
                        setMode('detail');
                      }
                    }}
                  >
                    {isProcessing ? '승인 중…' : '승인하기'}
                  </button>
                  <button
                    type="button"
                    className="admin-reading-log-dialog__button"
                    disabled={isProcessing}
                    onClick={() => setMode('detail')}
                  >
                    돌아가기
                  </button>
                </>
              ) : (
                renderDetailActions()
              )}
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

export default ReadingLogDetailDialog;
