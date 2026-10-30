import type { BookSearchResult } from '../../types/book';

type BookCoverProps = {
  book: BookSearchResult;
};

/** 도서 검색 결과·선택 도서의 표지 썸네일 (없으면 텍스트 placeholder) */
function BookCover({ book }: BookCoverProps) {
  if (book.thumbnailUrl) {
    return <img src={book.thumbnailUrl} alt="" loading="lazy" />;
  }

  return <span aria-hidden="true">BOOK</span>;
}

export default BookCover;
