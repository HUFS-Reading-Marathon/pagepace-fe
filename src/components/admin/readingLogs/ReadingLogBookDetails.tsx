import {
  getExpectedApprovedPages,
  getRemainingPages,
  type ReadingLogBookEntry,
  type ReadingLogValidationIssue,
} from '../../../types/adminReadingLog';

type ReadingLogBookDetailsProps = {
  books: ReadingLogBookEntry[];
  validationIssues: ReadingLogValidationIssue[];
};

/** 상세 검토 다이얼로그의 "책별 독서 내역" 섹션 */
function ReadingLogBookDetails({ books, validationIssues }: ReadingLogBookDetailsProps) {
  return (
    <section className="admin-reading-log-dialog__section" aria-labelledby="readingLogBooksTitle">
      <div className="admin-reading-log-dialog__section-heading">
        <h3 id="readingLogBooksTitle">책별 독서 내역</h3>
        <span>{books.length}권</span>
      </div>

      <div className="admin-reading-log-dialog__books">
        {books.map((book, index) => {
          const bookIssues = validationIssues.filter((issue) => issue.bookEntryId === book.id);
          const expectedApprovedPages = getExpectedApprovedPages(book);
          const remainingPages = getRemainingPages(book);
          const searchQuery = encodeURIComponent(`${book.title} ${book.author} ${book.publisher}`);

          return (
            <article
              key={book.id}
              className={[
                'admin-reading-log-dialog__book',
                bookIssues.length > 0 ? 'admin-reading-log-dialog__book--warning' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="admin-reading-log-dialog__book-heading">
                <div>
                  <span>책 {index + 1}</span>
                  <h4>{book.title || '제목 정보 없음'}</h4>
                  <p>
                    {book.author || '저자 정보 없음'} · {book.publisher || '출판사 정보 없음'}
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
                  <dd>{book.previouslyApprovedPages.toLocaleString('ko-KR')}쪽</dd>
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
                      remainingPages < 0 ? 'admin-reading-log-dialog__negative' : undefined
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
}

export default ReadingLogBookDetails;
