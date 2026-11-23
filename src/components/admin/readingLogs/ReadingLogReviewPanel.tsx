import { useState } from 'react';
import type { AdminReadingLogResponse } from '../../../types/adminReadingLogApi';
import { formatKoDateTime24 } from '../../../utils/date';
import ReadingLogRejectForm from './ReadingLogRejectForm';

export default function ReadingLogReviewPanel({
  log,
  disabled,
  onApprove,
  onReject,
}: {
  log: AdminReadingLogResponse;
  disabled: boolean;
  onApprove: () => Promise<boolean>;
  onReject: (reason: string) => Promise<boolean>;
}) {
  const [rejecting, setRejecting] = useState(false);
  return (
    <section className="admin-ledger__detail" aria-label={log.userName + ' 님의 독서일지'}>
      <p className="admin-reading-review__meta">
        학번 {log.studentNo} · {log.courseName} · 제출 {formatKoDateTime24(log.createdAt)}
      </p>
      {log.books.map((book) => (
        <article key={book.readingLogBookId} className="admin-ledger__book">
          <div>
            <h3>{book.bookTitle}</h3>
            <p>{[book.author, book.publisher, book.isbn].filter(Boolean).join(' · ')}</p>
            <p>
              이번 일지 {book.submittedReadPages}쪽 · 책 전체 {book.totalBookPages}쪽
            </p>
          </div>
          <a
            href={
              book.libraryBookId
                ? 'https://lib.hufs.ac.kr/global/search/i-discovery/' + book.libraryBookId
                : 'https://lib.hufs.ac.kr/global/search/i-discovery?' +
                  new URLSearchParams({ ALL: 'k|a|' + (book.isbn || book.bookTitle), offset: '0' })
            }
            target="_blank"
            rel="noopener noreferrer"
            className="admin-reading-log-dialog__search-link"
          >
            도서관 도서 정보 ↗
          </a>
        </article>
      ))}
      {log.adminComment && <p>검토 의견 · {log.adminComment}</p>}
      {log.reviewedAt && <p>처리 일시 · {formatKoDateTime24(log.reviewedAt)}</p>}
      {log.status === 'SUBMITTED' &&
        (rejecting ? (
          <ReadingLogRejectForm
            recommendedReasons={log.recommendedRejectReasons ?? []}
            isProcessing={disabled}
            onSubmit={onReject}
            onSuccess={() => setRejecting(false)}
            onBack={() => setRejecting(false)}
          />
        ) : (
          <div className="admin-ledger__actions">
            <button
              type="button"
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
              disabled={disabled}
            >
              승인
            </button>
          </div>
        ))}
    </section>
  );
}
