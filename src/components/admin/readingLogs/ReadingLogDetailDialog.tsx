import {
  type FormEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  DAILY_READING_PAGE_LIMIT,
  READING_LOG_REJECTION_REASONS,
  formatReadingDistance,
  formatReadingLogDate,
  formatReadingLogDateTime,
  getExpectedApprovedPages,
  getReadingDistanceMeters,
  getReadingLogTotalPages,
  getRemainingPages,
  validateReadingLog,
  type AdminReadingLog,
  type ReadingLogDialogMode,
} from '../../../types/adminReadingLog';
import ReadingLogStatusBadge from './ReadingLogStatusBadge';

type ReadingLogDetailDialogProps = {
  log: AdminReadingLog;
  initialMode: ReadingLogDialogMode;
  onClose: () => void;
  onApprove: (logId: string) => void;
  onReject: (logId: string, reason: string) => void;
};

function ReadingLogDetailDialog({
  log,
  initialMode,
  onClose,
  onApprove,
  onReject,
}: ReadingLogDetailDialogProps) {
  const [mode, setMode] = useState<ReadingLogDialogMode>(initialMode);
  const [suggestedReason, setSuggestedReason] = useState('');
  const [rejectionReason, setRejectionReason] = useState(
    log.rejectionReason ?? '',
  );
  const [rejectionError, setRejectionError] = useState('');
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const totalReadPages = getReadingLogTotalPages(log);
  const distanceMeters = getReadingDistanceMeters(totalReadPages);
  const validationIssues = validateReadingLog(log);
  const hasValidationIssue = validationIssues.length > 0;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const openRejectMode = () => {
    setSuggestedReason('');
    setRejectionReason('');
    setRejectionError('');
    setMode('reject');
  };

  const handleRejectSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedReason = rejectionReason.trim();

    if (!normalizedReason) {
      setRejectionError('반려 사유를 입력해 주세요.');
      return;
    }

    onReject(log.id, normalizedReason);
    setRejectionError('');
    setMode('detail');
  };

  const handleSuggestedReasonChange = (value: string) => {
    setSuggestedReason(value);
    setRejectionError('');

    if (value === '기타') {
      setRejectionReason('');
      return;
    }

    setRejectionReason(value);
  };

  const dialogTitle =
    mode === 'approve-confirm'
      ? '독서일지 승인 확인'
      : mode === 'reject'
        ? '독서일지 반려'
        : '독서일지 상세 검토';

  const renderBookDetails = () => (
    <section
      className="admin-reading-log-dialog__section"
      aria-labelledby="readingLogBooksTitle"
    >
      <div className="admin-reading-log-dialog__section-heading">
        <h3 id="readingLogBooksTitle">책별 독서 내역</h3>
        <span>{log.books.length}권</span>
      </div>

      <div className="admin-reading-log-dialog__books">
        {log.books.map((book, index) => {
          const bookIssues = validationIssues.filter(
            (issue) => issue.bookEntryId === book.id,
          );
          const expectedApprovedPages = getExpectedApprovedPages(book);
          const remainingPages = getRemainingPages(book);
          const searchQuery = encodeURIComponent(
            `${book.title} ${book.author} ${book.publisher}`,
          );

          return (
            <article
              key={book.id}
              className={[
                'admin-reading-log-dialog__book',
                bookIssues.length > 0
                  ? 'admin-reading-log-dialog__book--warning'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="admin-reading-log-dialog__book-heading">
                <div>
                  <span>책 {index + 1}</span>
                  <h4>{book.title || '제목 정보 없음'}</h4>
                  <p>
                    {book.author || '저자 정보 없음'} ·{' '}
                    {book.publisher || '출판사 정보 없음'}
                  </p>
                </div>
                <a
                  href={`https://www.google.com/search?q=${searchQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-reading-log-dialog__search-link"
                  aria-label={`${book.title || '제목 없는 책'} 도서 정보 외부 검색`}
                >
                  도서 정보 검색
                </a>
              </div>

              <dl className="admin-reading-log-dialog__book-pages">
                <div>
                  <dt>등록 전체</dt>
                  <dd>{book.totalPages.toLocaleString('ko-KR')}쪽</dd>
                </div>
                <div>
                  <dt>이전 승인 누적</dt>
                  <dd>
                    {book.previouslyApprovedPages.toLocaleString('ko-KR')}쪽
                  </dd>
                </div>
                <div>
                  <dt>오늘 읽음</dt>
                  <dd>{book.readPages.toLocaleString('ko-KR')}쪽</dd>
                </div>
                <div>
                  <dt>승인 예상 누적</dt>
                  <dd>{expectedApprovedPages.toLocaleString('ko-KR')}쪽</dd>
                </div>
                <div>
                  <dt>승인 후 잔여</dt>
                  <dd
                    className={
                      remainingPages < 0
                        ? 'admin-reading-log-dialog__negative'
                        : undefined
                    }
                  >
                    {remainingPages.toLocaleString('ko-KR')}쪽
                  </dd>
                </div>
              </dl>

              {bookIssues.length > 0 && (
                <ul className="admin-reading-log-dialog__issue-list">
                  {bookIssues.map((issue) => (
                    <li key={`${issue.code}-${issue.detail}`}>
                      <strong>{issue.label}</strong> — {issue.detail}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );

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
          disabled={hasValidationIssue}
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
          onClick={openRejectMode}
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
              {formatReadingLogDate(log.readingDate)} · {log.participantName}
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
          <form
            className="admin-reading-log-dialog__form"
            onSubmit={handleRejectSubmit}
          >
            <div className="admin-reading-log-dialog__content">
              <section className="admin-reading-log-dialog__section">
                <h3>반려 사유 입력</h3>
                <p className="admin-reading-log-dialog__mode-description">
                  참가자는 이 사유를 확인하고 독서일지를 수정해 다시 제출할 수
                  있습니다.
                </p>

                <label className="admin-reading-log-dialog__field">
                  <span>사유 선택</span>
                  <select
                    value={suggestedReason}
                    onChange={(event) =>
                      handleSuggestedReasonChange(event.target.value)
                    }
                  >
                    <option value="">사유를 선택해 주세요</option>
                    {READING_LOG_REJECTION_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="admin-reading-log-dialog__field">
                  <span>최종 반려 사유</span>
                  <textarea
                    rows={5}
                    value={rejectionReason}
                    placeholder={
                      suggestedReason === '기타'
                        ? '구체적인 반려 사유를 직접 입력해 주세요.'
                        : '선택한 사유를 보완하거나 직접 입력할 수 있습니다.'
                    }
                    aria-describedby={`readingLogRejectHint${
                      rejectionError ? ' readingLogRejectError' : ''
                    }`}
                    onChange={(event) => {
                      setRejectionReason(event.target.value);
                      setRejectionError('');
                    }}
                  />
                </label>
                <p
                  id="readingLogRejectHint"
                  className="admin-reading-log-dialog__field-hint"
                >
                  공백만 입력한 사유로는 반려할 수 없습니다.
                </p>
                {rejectionError && (
                  <p
                    id="readingLogRejectError"
                    className="admin-reading-log-dialog__error"
                    role="alert"
                  >
                    {rejectionError}
                  </p>
                )}
              </section>
            </div>

            <footer className="admin-reading-log-dialog__actions">
              <button
                type="submit"
                className="admin-reading-log-dialog__button admin-reading-log-dialog__button--danger"
              >
                반려하기
              </button>
              <button
                type="button"
                className="admin-reading-log-dialog__button"
                onClick={() => {
                  setRejectionError('');
                  setMode('detail');
                }}
              >
                돌아가기
              </button>
            </footer>
          </form>
        ) : (
          <>
            <div className="admin-reading-log-dialog__content">
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
                    <dd>{formatReadingLogDate(log.readingDate)}</dd>
                  </div>
                  <div>
                    <dt>제출 시각</dt>
                    <dd>{formatReadingLogDateTime(log.submittedAt)}</dd>
                  </div>
                  {log.approvedAt && (
                  <div>
                    <dt>검토 시각</dt>
                    <dd>{formatReadingLogDateTime(log.approvedAt)}</dd>
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
                    <dd>{formatReadingDistance(distanceMeters)}</dd>
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

              {log.reviewFlags && log.reviewFlags.length > 0 && (
                <section className="admin-reading-log-dialog__section">
                  <h3>수동 검토 참고</h3>
                  <ul className="admin-reading-log-dialog__manual-flags">
                    {log.reviewFlags.map((flag) => (
                      <li key={flag}>{flag}</li>
                    ))}
                  </ul>
                </section>
              )}

              {renderBookDetails()}

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
                    disabled={hasValidationIssue}
                    onClick={() => {
                      onApprove(log.id);
                      setMode('detail');
                    }}
                  >
                    승인하기
                  </button>
                  <button
                    type="button"
                    className="admin-reading-log-dialog__button"
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
