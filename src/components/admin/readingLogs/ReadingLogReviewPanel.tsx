import { useState } from 'react';
import {
  formatReadingDistance,
  getReadingDistanceMeters,
  getReadingLogTotalPages,
  validateReadingLog,
  type AdminReadingLog,
} from '../../../types/adminReadingLog';
import { formatKoDateKey, formatKoDateTime24 } from '../../../utils/date';
import ReadingLogBookDetails from './ReadingLogBookDetails';
import ReadingLogRejectForm from './ReadingLogRejectForm';
import ReadingLogStatusBadge from './ReadingLogStatusBadge';

/** 승인 전 관리자가 직접 확인해야 하는 항목. 자동 검증으로는 판단할 수 없는 내용입니다. */
const MANUAL_CHECK_ITEMS = [
  {
    key: 'book-info',
    label: '실제 도서와 정보가 일치합니다.',
    description: '책 제목·저자·출판사와 전체 쪽수를 외부 검색 결과와 대조했습니다.',
  },
  {
    key: 'not-excluded',
    label: '대회 제외 도서가 아닙니다.',
    description: '만화, 전공서적, 수험서·문제집, 원서, 정기간행물에 해당하지 않습니다.',
  },
] as const;

type ReadingLogReviewPanelProps = {
  log: AdminReadingLog;
  position: { index: number; total: number };
  hasNextPending: boolean;
  isLoading?: boolean;
  error?: string | null;
  isProcessing?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onApprove: (logId: string) => Promise<boolean>;
  onReject: (logId: string, reason: string) => Promise<boolean>;
};

/**
 * 독서일지 검토 화면 오른쪽 상세 패널입니다.
 * 목록을 유지한 채 상세를 확인하고, 승인·반려는 서버 응답이 성공한 뒤에만 다음 건으로 넘어갑니다.
 * 부모에서 일지별 key를 지정해 일지가 바뀌면 확인 항목과 반려 입력이 초기화됩니다.
 */
function ReadingLogReviewPanel({
  log,
  position,
  hasNextPending,
  isLoading = false,
  error = null,
  isProcessing = false,
  onPrevious,
  onNext,
  onApprove,
  onReject,
}: ReadingLogReviewPanelProps) {
  const [isRejecting, setIsRejecting] = useState(false);
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const totalReadPages = getReadingLogTotalPages(log);
  const distanceMeters = log.convertedDistanceMeter ?? getReadingDistanceMeters(totalReadPages);
  const validationIssues = validateReadingLog(log);
  const hasValidationIssue = validationIssues.length > 0;
  const isPending = log.status === 'submit';
  const allChecked = MANUAL_CHECK_ITEMS.every((item) => checkedItems.includes(item.key));
  const canApprove = isPending && !hasValidationIssue && allChecked && !isProcessing && !isLoading;

  const approveHint = hasValidationIssue
    ? '자동 검증 문제가 있어 승인할 수 없습니다. 반려 사유를 안내해 주세요.'
    : !allChecked
      ? '검토 항목을 모두 확인하면 승인할 수 있습니다.'
      : '승인 결과는 서버 처리 후 목록에 반영됩니다.';

  const toggleCheckItem = (key: string, checked: boolean) => {
    setCheckedItems((current) =>
      checked ? [...new Set([...current, key])] : current.filter((item) => item !== key),
    );
  };

  return (
    <section className="admin-detail-panel" aria-labelledby="readingLogPanelTitle">
      <header className="admin-detail-panel__head">
        <div>
          <p className="admin-detail-panel__eyebrow">
            {isRejecting ? '독서일지 반려' : '독서일지 상세 검토'}
          </p>
          <h2 id="readingLogPanelTitle">
            {log.participantName} 님의 독서일지
            <ReadingLogStatusBadge status={log.status} />
          </h2>
          <p className="admin-reading-review__meta">
            <span>독서일 {formatKoDateKey(log.readingDate)}</span>
            <span>제출 {formatKoDateTime24(log.submittedAt)}</span>
            <span>학번 {log.studentNumber}</span>
            {log.courseName && <span>{log.courseName}</span>}
          </p>
        </div>
        <div className="admin-detail-panel__nav">
          <span>
            {position.index + 1} / {position.total}
          </span>
          <button
            type="button"
            aria-label="이전 독서일지"
            disabled={!onPrevious || isProcessing}
            onClick={onPrevious}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="다음 독서일지"
            disabled={!onNext || isProcessing}
            onClick={onNext}
          >
            ›
          </button>
        </div>
      </header>

      {isRejecting ? (
        <ReadingLogRejectForm
          recommendedReasons={log.recommendedRejectReasons ?? []}
          error={error}
          isProcessing={isProcessing}
          onSubmit={(reason) => onReject(log.id, reason)}
          onSuccess={() => setIsRejecting(false)}
          onBack={() => setIsRejecting(false)}
        />
      ) : (
        <>
          <div className="admin-detail-panel__body">
            {isLoading && (
              <p className="admin-reading-log-dialog__notice" role="status">
                최신 상세 정보를 불러오는 중입니다.
              </p>
            )}
            {error && (
              <p className="admin-reading-log-dialog__error" role="alert">
                {error}
              </p>
            )}

            <ReadingLogBookDetails books={log.books} validationIssues={validationIssues} />

            {hasValidationIssue ? (
              <ul className="admin-reading-log-dialog__issue-list admin-reading-review__block">
                {validationIssues
                  .filter((issue) => !issue.bookEntryId)
                  .map((issue) => (
                    <li key={`${issue.code}-${issue.detail}`}>
                      <strong>{issue.label}</strong> — {issue.detail}
                    </li>
                  ))}
                {validationIssues.every((issue) => issue.bookEntryId) && (
                  <li>자동 검증에서 문제가 발견되었습니다. 위 책별 경고를 확인해 주세요.</li>
                )}
              </ul>
            ) : (
              <p className="admin-reading-log-dialog__warning admin-reading-review__block">
                <strong>자동 검증 통과는 도서 적합성을 보장하지 않습니다.</strong> 형식·합계·누적
                초과만 확인했습니다. 실제 도서 정보와 제외 도서 여부는 직접 확인해 주세요.
              </p>
            )}

            {isPending && (
              <section className="admin-reading-review__block" aria-labelledby="readingLogChecks">
                <h3 id="readingLogChecks" className="admin-reading-review__title">
                  검토 항목
                </h3>
                <ul className="admin-checklist">
                  {MANUAL_CHECK_ITEMS.map((item) => (
                    <li key={item.key}>
                      <label>
                        <input
                          type="checkbox"
                          checked={checkedItems.includes(item.key)}
                          disabled={hasValidationIssue || isProcessing}
                          onChange={(event) => toggleCheckItem(item.key, event.target.checked)}
                        />
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="admin-reading-review__effect admin-reading-review__block">
              <div>
                <span>{isPending ? '승인 시 반영' : '이 일지의 독서량'}</span>
                <strong>
                  {isPending ? '+' : ''}
                  {totalReadPages.toLocaleString('ko-KR')}쪽
                </strong>
                <small>
                  {log.books.length}권 · 환산 {formatReadingDistance(distanceMeters)}
                </small>
              </div>
              <p>
                {log.status === 'approve'
                  ? '승인된 쪽수입니다. 인정 거리는 해당 책의 서평 확인 후 반영됩니다.'
                  : log.status === 'rejected'
                    ? '반려된 일지는 쪽수와 거리에 반영되지 않습니다.'
                    : '승인하면 쪽수가 먼저 반영되고, 인정 거리는 서평 확인 후 반영됩니다.'}
              </p>
            </div>

            {log.approvedAt && (
              <p className="admin-reading-review__reviewed-at">
                검토 시각 {formatKoDateTime24(log.approvedAt)}
              </p>
            )}

            {log.status === 'rejected' && log.rejectionReason && (
              <section className="admin-reading-review__block">
                <h3 className="admin-reading-review__title">반려 사유</h3>
                <div className="admin-reading-log-dialog__rejection-reason">
                  {log.rejectionReason}
                </div>
                <p className="admin-reading-log-dialog__mode-description">
                  참가자는 이 사유를 확인한 뒤 기록을 수정해 다시 제출할 수 있습니다.
                </p>
              </section>
            )}
          </div>

          {isPending && (
            <footer className="admin-detail-panel__actions">
              <p className="admin-detail-panel__actions-hint">{approveHint}</p>
              <button
                type="button"
                className="admin-button admin-button--danger"
                disabled={isProcessing || isLoading}
                onClick={() => setIsRejecting(true)}
              >
                반려 사유 입력
              </button>
              <button
                type="button"
                className="admin-button admin-button--primary"
                disabled={!canApprove}
                aria-busy={isProcessing}
                onClick={() => void onApprove(log.id)}
              >
                {isProcessing ? '승인 중…' : hasNextPending ? '승인하고 다음' : '승인'}
              </button>
            </footer>
          )}
        </>
      )}
    </section>
  );
}

export default ReadingLogReviewPanel;
