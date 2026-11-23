import { useRef, useState } from 'react';
import { getApiErrorMessage } from '../../api/apiClient';
import { completeReview } from '../../api/readingLogApi';
import type { ParticipantBook, ReviewTargetBook } from '../../types/readingLog';

type ReviewBook = Pick<ParticipantBook, 'bookTitle' | 'participantBookId' | 'reviewSearchUrl'>;

export default function BookReviewActions({
  book,
  onReported,
}: {
  book: ReviewBook;
  onReported: (result: ReviewTargetBook) => void;
}) {
  const busy = useRef(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function report() {
    if (
      busy.current ||
      !window.confirm(
        `도서관 홈페이지에서 “${book.bookTitle}” 서평을 저장하셨나요? 담당자에게 이 책의 서평 확인을 요청합니다.`,
      )
    )
      return;
    busy.current = true;
    setSending(true);
    setError('');
    try {
      const result = await completeReview(book.participantBookId);
      if (result) onReported(result);
      else setError('서평 알림 처리 결과를 확인할 수 없습니다. 새로고침 후 확인해 주세요.');
    } catch (error) {
      setError(getApiErrorMessage(error, '서평 확인 요청을 보내지 못했습니다.'));
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  return (
    <div className="review-actions">
      {book.reviewSearchUrl && (
        <a
          className="btn btn-secondary"
          href={book.reviewSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          도서관에서 서평 작성 ↗
        </a>
      )}
      <label className="review-self-report">
        <input type="checkbox" checked={false} disabled={sending} onChange={report} />
        도서관에서 서평을 작성했어요
      </label>
      <small>
        체크하면 담당자에게 작성 사실이 전달됩니다. 인정 거리는 담당자가 서평을 확인한 뒤
        반영됩니다.
      </small>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
