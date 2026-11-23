import { useEffect, useRef, useState } from 'react';
import { getBookThumbnail, lookupReviewBook } from '../../../api/bookApi';
import type {
  AdminReadingLogBookResponse,
  AdminReadingLogResponse,
} from '../../../types/adminReadingLogApi';
import type { BookSearchResult } from '../../../types/book';
import { formatKoDateTime24 } from '../../../utils/date';
import BookCover from '../../logs/BookCover';
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

function SubmittedBook({
  book,
  pending,
  bookNumber,
}: {
  book: AdminReadingLogBookResponse;
  pending: boolean;
  bookNumber?: number;
}) {
  const { libraryBookId, isbn, bookTitle } = book;
  const [result, setResult] = useState<LookupResult | null>(null);
  const [failedCovers, setFailedCovers] = useState<string[]>([]);
  const [isbnCover, setIsbnCover] = useState<string | null>(null);
  const storedCover = book.coverImageUrl?.trim();
  const missingBibliography =
    !libraryBookId ||
    [bookTitle, book.callNo, isbn, book.author, book.publisher].some((value) => !value?.trim());
  const needsLookup =
    !!(libraryBookId || isbn?.trim()) &&
    (missingBibliography || !storedCover || failedCovers.includes(storedCover));

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
  const catalogId = libraryBookId || catalog?.libraryBookId;
  const href = catalogLink(catalogId, identifier || title || '');
  const author = book.author?.trim() || catalog?.author?.trim();
  const publisher = book.publisher?.trim() || catalog?.publisher?.trim();
  const cover = [storedCover, catalog?.thumbnailUrl, isbnCover].find(
    (url) => url && !failedCovers.includes(url),
  );
  const thumbnailIsbn = !cover && !isbnCover && (!needsLookup || result) ? identifier : null;
  useEffect(() => {
    if (!thumbnailIsbn) return;
    const request = new AbortController();
    getBookThumbnail(thumbnailIsbn, request.signal)
      .then((url) => {
        if (!request.signal.aborted && url) setIsbnCover(url);
      })
      .catch(() => {
        /* The cover is optional; the submitted record remains reviewable. */
      });
    return () => request.abort();
  }, [thumbnailIsbn]);
  return (
    <li className="log-review__book">
      <div className="log-review__cover">
        <BookCover
          book={{ thumbnailUrl: cover || null }}
          placeholder="표지 없음"
          onError={() => {
            if (cover)
              setFailedCovers((current) =>
                current.includes(cover) ? current : [...current, cover],
              );
          }}
        />
      </div>
      <div className="log-review__book-info">
        <div className="log-review__book-heading">
          {bookNumber && <span className="log-review__book-number">책 {bookNumber}</span>}
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
        <p className="log-review__byline">
          <span className="sr-only">저자 </span>
          {author || '저자 미확인'}
          <span className="log-review__dot" aria-hidden="true">
            {' '}
            ·{' '}
          </span>
          <span className="sr-only">출판사 </span>
          {publisher || '출판사 미확인'}
        </p>
        <dl className="log-review__bibliography">
          <div>
            <dt>청구기호</dt>
            <dd>{book.callNo?.trim() || catalog?.callNo?.trim() || '미확인'}</dd>
          </div>
          <div>
            <dt>ISBN</dt>
            <dd>{identifier || '미확인'}</dd>
          </div>
          <div>
            <dt>서지번호</dt>
            <dd>{catalogId || '미확인'}</dd>
          </div>
        </dl>
        {missingBibliography && needsLookup && result?.status !== 'matched' && (
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
        <div className="log-review__submitted">
          <dt>이번 제출</dt>
          <dd>
            <strong>{book.submittedReadPages.toLocaleString('ko-KR')}</strong>쪽
          </dd>
        </div>
        <div>
          <dt>{pending ? '기존 승인' : '다른 일지 승인'}</dt>
          <dd>{book.existingApprovedReadPages.toLocaleString('ko-KR')}쪽</dd>
        </div>
        <div>
          <dt>책 전체</dt>
          <dd>{book.totalBookPages.toLocaleString('ko-KR')}쪽</dd>
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
        {log.books.map((book, index) => (
          <SubmittedBook
            key={JSON.stringify([
              book.readingLogBookId,
              book.libraryBookId,
              book.isbn,
              book.bookTitle,
            ])}
            book={book}
            pending={pending}
            bookNumber={log.books.length > 1 ? index + 1 : undefined}
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
