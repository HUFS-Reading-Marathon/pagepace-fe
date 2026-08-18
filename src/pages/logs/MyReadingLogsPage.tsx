import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/apiClient';
import { getCurrentParticipation } from '../../api/participationApi';
import { getMyReadingLogs } from '../../api/readingLogApi';
import type { ReadingLog, ReadingLogBook } from '../../types/readingLog';
import { formatDistance } from '../../utils/reading';
import './logs.css';

const STATUS_LABEL = { SUBMITTED: '검토중', APPROVED: '인정', REJECTED: '반려' } as const;
const PREVIEW_BOOK_COUNT = 5;

type ShelfBook = Pick<
  ReadingLogBook,
  'libraryBookId' | 'bookTitle' | 'author' | 'publisher' | 'coverImageUrl' | 'totalBookPages'
> & {
  approvedPages: number;
  latestLogId: number;
  latestReadingDate: string;
};

function buildShelfBooks(logs: ReadingLog[]) {
  const shelf = new Map<number, ShelfBook>();

  logs.forEach((log) => {
    log.books.forEach((book) => {
      const current = shelf.get(book.libraryBookId);
      const isLatest = !current || log.readingDate > current.latestReadingDate;
      const approvedPages = current?.approvedPages ?? 0;

      shelf.set(book.libraryBookId, {
        libraryBookId: book.libraryBookId,
        bookTitle: isLatest ? book.bookTitle : current.bookTitle,
        author: isLatest ? book.author : current.author,
        publisher: isLatest ? book.publisher : current.publisher,
        coverImageUrl: (isLatest ? book.coverImageUrl : current.coverImageUrl) || current?.coverImageUrl || null,
        totalBookPages: Math.max(book.totalBookPages, current?.totalBookPages ?? 0),
        approvedPages: approvedPages + (log.status === 'APPROVED' ? book.readPages : 0),
        latestLogId: isLatest ? log.readingLogId : current.latestLogId,
        latestReadingDate: isLatest ? log.readingDate : current.latestReadingDate,
      });
    });
  });

  return [...shelf.values()].sort((a, b) => b.latestReadingDate.localeCompare(a.latestReadingDate));
}

function BookCover({ book }: { book: ShelfBook }) {
  return (
    <div className="my-library-book-cover">
      {book.coverImageUrl ? <img src={book.coverImageUrl} alt={`${book.bookTitle} 표지`} /> : (
        <div className="my-library-cover-fallback" aria-hidden="true">
          <span>PAGEPACE</span>
          <strong>{book.bookTitle}</strong>
        </div>
      )}
    </div>
  );
}

function BookShelf({
  title,
  description,
  books,
  emptyMessage,
}: {
  title: string;
  description: string;
  books: ShelfBook[];
  emptyMessage: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleBooks = showAll ? books : books.slice(0, PREVIEW_BOOK_COUNT);

  return (
    <section className="my-library-shelf-section">
      <div className="my-library-shelf-head">
        <div>
          <div className="my-library-shelf-title"><h2>{title}</h2><span>{books.length}권</span></div>
          <p>{description}</p>
        </div>
        {books.length > PREVIEW_BOOK_COUNT && (
          <button type="button" className="my-library-more" onClick={() => setShowAll((current) => !current)}>
            {showAll ? '접기' : '전체보기'} <span aria-hidden="true">{showAll ? '↑' : '→'}</span>
          </button>
        )}
      </div>

      {visibleBooks.length === 0 ? <div className="my-library-empty">{emptyMessage}</div> : (
        <div className="my-library-shelf">
          <div className="my-library-book-grid">
            {visibleBooks.map((book) => {
              const totalPages = Math.max(book.totalBookPages, 1);
              const progress = Math.min(100, Math.round((book.approvedPages / totalPages) * 100));
              const isCompleted = book.approvedPages >= book.totalBookPages && book.totalBookPages > 0;

              return (
                <Link key={book.libraryBookId} to={`/logs/${book.latestLogId}`} className="my-library-book">
                  <BookCover book={book} />
                  <div className="my-library-book-info">
                    <strong>{book.bookTitle}</strong>
                    <span>{book.author || book.publisher || '도서 정보 없음'}</span>
                    <div className="my-library-progress" aria-label={`독서 진행률 ${progress}%`}>
                      <i style={{ width: `${progress}%` }} />
                    </div>
                    <small>{isCompleted ? '완독' : `${book.approvedPages.toLocaleString()} / ${book.totalBookPages.toLocaleString()}쪽`}</small>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function MyReadingLogsPage() {
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [showAllLogs, setShowAllLogs] = useState(false);

  useEffect(() => {
    let isActive = true;
    getCurrentParticipation()
      .then((participation) => getMyReadingLogs(participation.participationId))
      .then((nextLogs) => {
        if (isActive) setLogs([...nextLogs].sort((a, b) => b.readingDate.localeCompare(a.readingDate)));
      })
      .catch((error: unknown) => {
        if (isActive) setErrorMessage(error instanceof ApiError ? error.message : '독서일지를 불러오지 못했습니다.');
      })
      .finally(() => { if (isActive) setIsLoading(false); });
    return () => { isActive = false; };
  }, []);

  const shelfBooks = useMemo(() => buildShelfBooks(logs), [logs]);
  const readingBooks = shelfBooks.filter((book) => book.totalBookPages <= 0 || book.approvedPages < book.totalBookPages);
  const completedBooks = shelfBooks.filter((book) => book.totalBookPages > 0 && book.approvedPages >= book.totalBookPages);
  const visibleLogs = showAllLogs ? logs : logs.slice(0, 5);

  return (
    <main className="log-page my-library-page">
      <section className="my-library-hero">
        <div><p className="log-label">My Library</p><h1>나의 서재</h1><p>읽고 있는 책과 완독한 책을 한눈에 확인해 보세요.</p></div>
        <Link to="/logs/new" className="log-primary-link">독서일지 작성</Link>
      </section>

      {isLoading ? <div className="my-library-state">나의 서재를 불러오고 있습니다.</div> : errorMessage ? <div className="my-library-state reading-log-error">{errorMessage}</div> : (
        <>
          <div className="my-library-summary" aria-label="나의 서재 요약">
            <div><span>전체 도서</span><strong>{shelfBooks.length}<small>권</small></strong></div>
            <div><span>읽고 있는 책</span><strong>{readingBooks.length}<small>권</small></strong></div>
            <div><span>완독한 책</span><strong>{completedBooks.length}<small>권</small></strong></div>
          </div>

          <div className="my-library-shelves">
            <BookShelf title="읽고 있는 책" description="최근에 펼쳐 본 책부터 보여드려요." books={readingBooks} emptyMessage="현재 읽고 있는 책이 없습니다." />
            <BookShelf title="완독한 책" description="인정된 독서 페이지를 기준으로 완독한 책이에요." books={completedBooks} emptyMessage="아직 완독한 책이 없습니다." />
          </div>

          <section className="my-library-recent">
            <div className="my-library-recent-head"><div><h2>최근 독서일지</h2><p>제출 상태와 상세 기록을 확인할 수 있습니다.</p></div>{logs.length > 5 && <button type="button" className="my-library-more" onClick={() => setShowAllLogs((current) => !current)}>{showAllLogs ? '접기' : '전체보기'}</button>}</div>
            {visibleLogs.length === 0 ? <div className="my-library-empty">아직 제출한 독서일지가 없습니다.</div> : <div className="my-library-log-list">{visibleLogs.map((log) => <Link key={log.readingLogId} to={`/logs/${log.readingLogId}`} className="my-library-log-row"><span className={`log-status-badge status-${STATUS_LABEL[log.status]}`}>{STATUS_LABEL[log.status]}</span><div><strong>{log.books.map((book) => book.bookTitle).join(', ')}</strong><span>{log.readingDate} · {log.books.length}권</span></div><dl><div><dt>읽은 페이지</dt><dd>{log.totalReadPages.toLocaleString()}쪽</dd></div><div><dt>환산 거리</dt><dd>{formatDistance(log.convertedDistanceMeter)}</dd></div></dl><span className="my-library-log-arrow" aria-hidden="true">→</span></Link>)}</div>}
          </section>
        </>
      )}
    </main>
  );
}

export default MyReadingLogsPage;
