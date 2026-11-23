import { useRef, useState } from 'react';
import type {
  AdminReadingLogBookResponse,
  AdminReadingLogResponse,
} from '../../../types/adminReadingLogApi';
import { formatKoDateTime24 } from '../../../utils/date';
import ReadingLogRejectForm from './ReadingLogRejectForm';
import './reading-log-review.css';

const LIBRARY_CATALOG = 'https://lib.hufs.ac.kr/global/search/i-discovery';

function catalogLink(book: AdminReadingLogBookResponse) {
  if (book.libraryBookId) return LIBRARY_CATALOG + '/' + book.libraryBookId;
  const keyword = book.isbn?.trim() || book.bookTitle?.trim();
  return keyword
    ? LIBRARY_CATALOG + '?' + new URLSearchParams({ ALL: 'k|a|' + keyword, offset: '0' })
    : null;
}

function SubmittedBook({ book, pending }: { book: AdminReadingLogBookResponse; pending: boolean }) {
  const href = catalogLink(book);
  const title = book.bookTitle?.trim() || '제목 미입력';
  const publication = [book.author, book.publisher].filter(Boolean).join(' · ');
  return (
    <li className="log-review__book">
      <div className="log-review__book-info">
        <h3>{title}</h3>
        {(publication || book.isbn) && (
          <p className="log-review__publication">
            {publication && <span>{publication}</span>}
            {book.isbn && <span>ISBN {book.isbn}</span>}
          </p>
        )}
      </div>
      <p className="log-review__pages">
        이번 기록 <strong>{book.submittedReadPages.toLocaleString('ko-KR')}쪽</strong>
        <span>전체 {book.totalBookPages.toLocaleString('ko-KR')}쪽</span>
        {pending && book.existingApprovedReadPages > 0 && (
          <span>기존 승인 {book.existingApprovedReadPages.toLocaleString('ko-KR')}쪽</span>
        )}
      </p>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="log-review__catalog"
          aria-label={title + ' 도서관 조회 (새 창)'}
        >
          도서관 조회 <span aria-hidden="true">↗</span>
        </a>
      )}
      {pending && (book.pageExceeded || book.warningMessage) && (
        <p className="log-review__warning">
          {book.warningMessage || '이번 기록을 더하면 책 전체 쪽수를 초과합니다.'}
        </p>
      )}
    </li>
  );
}

export default function ReadingLogReviewPanel({
  log,
  disabled,
  actionError,
  readOnly = false,
  onApprove,
  onReject,
}: {
  log: AdminReadingLogResponse;
  disabled: boolean;
  actionError?: string;
  readOnly?: boolean;
  onApprove: () => Promise<boolean>;
  onReject: (reason: string) => Promise<boolean>;
}) {
  const [rejecting, setRejecting] = useState(false);
  const rejectButton = useRef<HTMLButtonElement>(null);
  const pending = log.status === 'SUBMITTED';
  const canApprove = !log.books.some((book) => book.pageExceeded);
  return (
    <section className="log-review" aria-label={log.userName + ' 님의 독서일지'}>
      <dl className="log-review__meta">
        <div>
          <dt>코스</dt>
          <dd>{log.courseName}</dd>
        </div>
        <div>
          <dt>최초 제출</dt>
          <dd>
            <time dateTime={log.createdAt}>{formatKoDateTime24(log.createdAt)}</time>
          </dd>
        </div>
        {pending && log.updatedAt && log.updatedAt !== log.createdAt && (
          <div>
            <dt>마지막 변경</dt>
            <dd>
              <time dateTime={log.updatedAt}>{formatKoDateTime24(log.updatedAt)}</time>
            </dd>
          </div>
        )}
      </dl>
      <ul className="log-review__books" aria-label="기록한 도서">
        {log.books.map((book) => (
          <SubmittedBook key={book.readingLogBookId} book={book} pending={pending} />
        ))}
      </ul>
      {!log.books.length && <p className="log-review__note">등록된 도서가 없습니다.</p>}
      {log.memo?.trim() && (
        <div className="log-review__note">
          <strong>일지 메모</strong>
          <p>{log.memo}</p>
        </div>
      )}
      {!pending && (log.reviewedAt || log.adminComment) && (
        <dl className="log-review__history">
          {log.reviewedAt && (
            <div>
              <dt>{log.status === 'APPROVED' ? '승인 일시' : '반려 일시'}</dt>
              <dd>
                <time dateTime={log.reviewedAt}>{formatKoDateTime24(log.reviewedAt)}</time>
              </dd>
            </div>
          )}
          {log.adminComment && (
            <div>
              <dt>{log.status === 'REJECTED' ? '반려 사유' : '처리 의견'}</dt>
              <dd>{log.adminComment}</dd>
            </div>
          )}
        </dl>
      )}
      {actionError && (
        <p className="log-review__error" role="alert">
          {actionError}
        </p>
      )}
      {pending && readOnly && <p className="log-review__note">결과가 확정된 행사입니다.</p>}
      {pending &&
        !readOnly &&
        (rejecting ? (
          <ReadingLogRejectForm
            recommendedReasons={log.recommendedRejectReasons ?? []}
            isProcessing={disabled}
            onSubmit={onReject}
            onSuccess={() => setRejecting(false)}
            onBack={() => {
              setRejecting(false);
              requestAnimationFrame(() => rejectButton.current?.focus({ preventScroll: true }));
            }}
          />
        ) : (
          <div className="log-review__actions">
            <button
              type="button"
              ref={rejectButton}
              className="admin-button admin-button--danger"
              onClick={() => setRejecting(true)}
              disabled={disabled}
            >
              반려
            </button>
            <button
              type="button"
              className="admin-button admin-button--primary"
              onClick={() => void onApprove()}
              disabled={disabled || !canApprove}
            >
              승인
            </button>
          </div>
        ))}
    </section>
  );
}
