import type { BookSearchResult } from '../../types/book';

type BookCoverProps = {
  book: Pick<BookSearchResult, 'thumbnailUrl'>;
  placeholder?: string;
  onError?: () => void;
};

/** 도서 검색 결과·선택 도서의 표지 썸네일 (없으면 텍스트 placeholder) */
function BookCover({ book, placeholder = 'BOOK', onError }: BookCoverProps) {
  if (book.thumbnailUrl) {
    return <img src={book.thumbnailUrl} alt="" loading="lazy" onError={onError} />;
  }

  return <span aria-hidden="true">{placeholder}</span>;
}

export default BookCover;
