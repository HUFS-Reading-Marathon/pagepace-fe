import { useEffect, useRef, useState } from 'react';
import { lookupReviewBook } from '../../../api/bookApi';
import type {
  AdminReadingLogBookResponse,
  AdminReadingLogResponse,
} from '../../../types/adminReadingLogApi';
import type { BookSearchResult } from '../../../types/book';
import { formatKoDateTime24 } from '../../../utils/date';
import ReadingLogRejectForm from './ReadingLogRejectForm';
import './reading-log-review.css';

const LIBRARY_CATALOG = 'https://lib.hufs.ac.kr/global/search/i-discovery';

function catalogLink(id: number | null | undefined, keyword: string) {
  if (id) return LIBRARY_CATALOG + '/' + id;
  return keyword
    ? LIBRARY_CATALOG + '?' + new URLSearchParams({ ALL: 'k|a|' + keyword, offset: '0' })
    : null;
}

type LookupResult =
  { status: 'matched'; book: BookSearchResult } | { status: 'missing' | 'failed' };

function SubmittedBook({ book, pending }: { book: AdminReadingLogBookResponse; pending: boolean }) {
  const { libraryBookId, isbn, bookTitle } = book;
  const [result, setResult] = useState<LookupResult | null>(null);
  const needsLookup =
    !!(libraryBookId || isbn?.trim()) &&
    [bookTitle, book.callNo, isbn, book.author, book.publisher].some((value) => !value?.trim());

  useEffect(() => {
    if (!needsLookup) return;
    const request = new AbortController();
    lookupReviewBook({ libraryBookId, isbn, bookTitle }, request.signal)
      .then((match) => {
        if (!request.signal.aborted)
          setResult(match ? { status: 'matched', book: match } : { status: 'missing' });
      })
      .catch(() => {
        if (!request.signal.aborted) setResult({ status: 'failed' });
      });
    return () => request.abort();
  }, [needsLookup, libraryBookId, isbn, bookTitle]);

  const catalog = needsLookup && result?.status === 'matched' ? result.book : null;
  const title = bookTitle?.trim() || catalog?.title?.trim();
  const identifier = isbn?.trim() || catalog?.isbn?.trim();
  const href = catalogLink(libraryBookId || catalog?.libraryBookId, identifier || title || '');
  const fields = [
    ['저자', book.author?.trim() || catalog?.author?.trim()],
    ['출판사', book.publisher?.trim() || catalog?.publisher?.trim()],
    ['청구기호', book.callNo?.trim() || catalog?.callNo?.trim()],
    ['ISBN', identifier],
  ];
  return (
    <li className="log-review__book">
      <div className="log-review__book-info">
        <div className="log-review__book-heading">
          <h3>{title || '제목 미확인'}</h3>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="log-review__catalog"
              aria-label={(title || '도서') + ' 도서관 조회 (새 창)'}
            >
              도서관 조회 <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
        <dl className="log-review__bibliography">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={value ? undefined : 'log-review__unknown'}>{value || '미확인'}</dd>
            </div>
          ))}
        </dl>
        {needsLookup && result?.status !== 'matched' && (
          <p className="log-review__lookup" role="status">
            {!result
              ? '도서관 서지정보 조회 중…'
              : result.status === 'failed'
                ? '도서관 서지정보를 불러오지 못했습니다.'
                : '일치하는 도서관 서지정보가 없습니다.'}
          </p>
        )}
      </div>
      <dl className="log-review__pages" aria-label="독서 쪽수">
        <div>
          <dt>이번 제출</dt>
          <dd>
            <strong>{book.submittedReadPages.toLocaleString('ko-KR')}쪽</strong>
          </dd>
        </div>
        <div>
          <dt>책 전체</dt>
          <dd>{book.totalBookPages.toLocaleString('ko-KR')}쪽</dd>
        </div>
        <div>
          <dt>{pending ? '기존 승인' : '다른 일지 승인'}</dt>
          <dd>{book.existingApprovedReadPages.toLocaleString('ko-KR')}쪽</dd>
        </div>
      </dl>
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
  const canApprove = log.books.length > 0 && !log.books.some((book) => book.pageExceeded);
  const hasDetails = !!log.memo?.trim() || (!pending && !!(log.reviewedAt || log.adminComment));
  return (
    <section className="log-review" aria-label={log.userName + ' 님의 독서일지'}>
      <ul className="log-review__books" aria-label="기록한 도서">
        {log.books.map((book) => (
          <SubmittedBook
            key={JSON.stringify([
              book.readingLogBookId,
              book.libraryBookId,
              book.isbn,
              book.bookTitle,
            ])}
            book={book}
            pending={pending}
          />
        ))}
      </ul>
      {!log.books.length && <p className="log-review__message">등록된 도서가 없습니다.</p>}
      {hasDetails && (
        <dl className="log-review__details">
          {log.memo?.trim() && (
            <div>
              <dt>일지 메모</dt>
              <dd>{log.memo}</dd>
            </div>
          )}
          {!pending && log.reviewedAt && (
            <div>
              <dt>{log.status === 'APPROVED' ? '승인 일시' : '반려 일시'}</dt>
              <dd>
                <time dateTime={log.reviewedAt}>{formatKoDateTime24(log.reviewedAt)}</time>
              </dd>
            </div>
          )}
          {!pending && log.adminComment && (
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
      {pending && readOnly && <p className="log-review__message">결과가 확정된 행사입니다.</p>}
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
