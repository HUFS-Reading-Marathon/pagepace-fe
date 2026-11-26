import type { ParticipantBook } from '../../types/readingLog';

type ReviewBook = Pick<ParticipantBook, 'bookTitle' | 'participantBookId' | 'reviewSearchUrl'>;

/** 학생에게는 신고 절차 없이 도서관 서평 작성 안내만 보여 줍니다(PDF 5쪽). */
export const REVIEW_GUIDE_TEXT =
  '도서관에 서평을 남겨 주세요. 담당자가 확인하면 이 책의 승인된 독서일지 1쪽당 5m가 반영됩니다.';

/**
 * 도서관 서평 작성 링크와 안내. 서평 반영은 담당자가 도서관 서평(개별 확인·솔라스 엑셀 대조)을
 * 확인해 처리하므로, 학생이 작성 사실을 따로 알리는 단계(서평 완료 신고 API)는 쓰지 않습니다.
 */
export default function BookReviewActions({
  book,
  showGuide = true,
}: {
  book: ReviewBook;
  showGuide?: boolean;
}) {
  return (
    <div className="review-actions">
      {book.reviewSearchUrl && (
        <a
          className="btn btn-secondary"
          href={book.reviewSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`도서관에서 “${book.bookTitle}” 서평 작성 (새 탭)`}
        >
          도서관에서 서평 작성 ↗
        </a>
      )}
      {showGuide && <small>{REVIEW_GUIDE_TEXT}</small>}
    </div>
  );
}
