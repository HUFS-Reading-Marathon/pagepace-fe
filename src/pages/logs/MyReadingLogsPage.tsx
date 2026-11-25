import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../../api/apiClient';
import { getCurrentParticipation } from '../../api/participationApi';
import { getMyReadingLogs } from '../../api/readingLogApi';
import {
  READING_LOG_STATUS_LABELS,
  type ReadingLog,
  type ReadingLogBook,
} from '../../types/readingLog';
import { canSubmitReadingLog } from '../../utils/eventSelection';
import { formatPreciseDistance, getProgressPercent } from '../../utils/reading';
import { formatKoDateKey } from '../../utils/date';
import './logs.css';

const PREVIEW_BOOK_COUNT = 5;
const PREVIEW_LOG_COUNT = 5;

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
        coverImageUrl:
          (isLatest ? book.coverImageUrl : current.coverImageUrl) || current?.coverImageUrl || null,
        totalBookPages: Math.max(book.totalBookPages, current?.totalBookPages ?? 0),
        approvedPages: approvedPages + (log.status === 'APPROVED' ? book.readPages : 0),
        latestLogId: isLatest ? log.readingLogId : current.latestLogId,
        latestReadingDate: isLatest ? log.readingDate : current.latestReadingDate,
      });
    });
  });

  return [...shelf.values()].sort((a, b) => b.latestReadingDate.localeCompare(a.latestReadingDate));
}

/** 표지: 실제 이미지가 있으면 이미지만, 없거나 불러오지 못하면 블루그레이 대체 표지(제목)를 보여 줍니다. */
function BookCover({ book }: { book: ShelfBook }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = book.coverImageUrl && book.coverImageUrl !== failedUrl ? book.coverImageUrl : null;

  return (
    <div className="my-library-book-cover">
      {url ? (
        <img src={url} alt="" loading="lazy" onError={() => setFailedUrl(url)} />
      ) : (
        <div className="my-library-cover-fallback" aria-hidden="true">
          <strong>{book.bookTitle}</strong>
        </div>
      )}
    </div>
  );
}

/** 말줄임으로 잘린 경우에만 전체 내용을 툴팁(title)으로 보여 줍니다. 짧은 글에는 툴팁을 두지 않습니다. */
function TruncatedText({ as: Tag, text }: { as: 'strong' | 'span'; text: string }) {
  const ref = useRef<HTMLElement>(null);
  const [truncated, setTruncated] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setTruncated(element.scrollWidth > element.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  return (
    <Tag ref={ref as never} title={truncated ? text : undefined}>
      {text}
    </Tag>
  );
}

function BookCard({ book }: { book: ShelfBook }) {
  const totalPages = Math.max(book.totalBookPages, 1);
  const progress = Math.min(100, getProgressPercent(book.approvedPages, totalPages));
  const isCompleted = book.approvedPages >= book.totalBookPages && book.totalBookPages > 0;
  const byline = book.author || book.publisher || '도서 정보 없음';

  return (
    <Link to={`/logs/${book.latestLogId}`} className="my-library-book">
      <BookCover book={book} />
      <span className="my-library-book-info">
        <TruncatedText as="strong" text={book.bookTitle} />
        <TruncatedText as="span" text={byline} />
        {isCompleted ? (
          <small className="my-library-book-done">
            완독 · {book.totalBookPages.toLocaleString()}쪽
          </small>
        ) : (
          <>
            <span
              className="my-library-progress"
              role="img"
              aria-label={`독서 진행률 ${progress}%`}
            >
              <i style={{ width: `${progress}%` }} />
            </span>
            <small>
              {book.approvedPages.toLocaleString()} / {book.totalBookPages.toLocaleString()}쪽
              <b>{Math.round(progress)}%</b>
            </small>
          </>
        )}
      </span>
    </Link>
  );
}

/**
 * 책 선반: 기본은 가로 한 줄(트랙패드·터치·키보드로 이동, 데스크톱은 이전·다음 버튼),
 * 전체 보기를 누르면 모든 책을 여러 줄로 펼칩니다. 자동 넘김·무한 반복은 하지 않습니다.
 */
function BookShelf({
  title,
  books,
  emptyMessage,
}: {
  title: string;
  books: ShelfBook[];
  emptyMessage: string;
}) {
  const headingId = useId();
  const [showAll, setShowAll] = useState(false);
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ prev: false, next: false });

  // 스크롤 위치에 따라 이전·다음 버튼을 켜고 끕니다(넘칠 것이 없으면 버튼을 숨깁니다).
  const updateEdges = useCallback(() => {
    const element = track.current;
    if (!element) return;
    const max = element.scrollWidth - element.clientWidth;
    setEdges({ prev: element.scrollLeft > 2, next: element.scrollLeft < max - 2 });
  }, []);

  useEffect(() => {
    const element = track.current;
    if (!element || showAll) return;
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(element);
    element.addEventListener('scroll', updateEdges, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', updateEdges);
    };
  }, [books.length, showAll, updateEdges]);

  const move = (direction: -1 | 1) => {
    const element = track.current;
    if (!element) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollBy({
      left: direction * element.clientWidth * 0.85,
      behavior: reduce ? 'auto' : 'smooth',
    });
  };

  const hasOverflow = !showAll && (edges.prev || edges.next);

  return (
    <section className="my-library-shelf-section" aria-labelledby={headingId}>
      <div className="my-library-shelf-head">
        <h2 id={headingId}>
          {title}
          <small>{books.length.toLocaleString()}권</small>
        </h2>
        <div className="my-library-shelf-actions">
          {hasOverflow && (
            <>
              <button
                type="button"
                className="my-library-nav"
                aria-label={`${title} 이전 책`}
                disabled={!edges.prev}
                onClick={() => move(-1)}
              >
                <span aria-hidden="true">‹</span>
              </button>
              <button
                type="button"
                className="my-library-nav"
                aria-label={`${title} 다음 책`}
                disabled={!edges.next}
                onClick={() => move(1)}
              >
                <span aria-hidden="true">›</span>
              </button>
            </>
          )}
          {books.length > PREVIEW_BOOK_COUNT && (
            <button
              type="button"
              className="my-library-more"
              aria-expanded={showAll}
              onClick={() => setShowAll((current) => !current)}
            >
              {showAll ? '접기' : '전체 보기'}
            </button>
          )}
        </div>
      </div>

      {books.length === 0 ? (
        <p className="my-library-empty">{emptyMessage}</p>
      ) : (
        <ul
          ref={track}
          className={showAll ? 'my-library-books is-all' : 'my-library-books'}
          aria-label={`${title} 목록`}
        >
          {books.map((book) => (
            <li key={book.libraryBookId}>
              <BookCard book={book} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentLogs({ logs }: { logs: ReadingLog[] }) {
  const navigate = useNavigate();

  return (
    <table className="my-library-log-table">
      <caption className="sr-only">최근 독서일지</caption>
      <thead>
        <tr>
          <th scope="col">도서명</th>
          <th scope="col">독서일</th>
          <th scope="col">독서량</th>
          <th scope="col">예상 환산 거리</th>
          <th scope="col">상태</th>
          <th scope="col">
            <span className="sr-only">상세</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => {
          const titles = log.books.map((book) => book.bookTitle).join(', ');
          const to = `/logs/${log.readingLogId}`;
          return (
            // 행 어디를 눌러도 상세로 이동하고, 키보드는 도서명 링크로 이동합니다.
            <tr key={log.readingLogId} onClick={() => navigate(to)}>
              <td className="my-library-log-title">
                <Link to={to} title={titles} onClick={(event) => event.stopPropagation()}>
                  {titles}
                </Link>
              </td>
              <td className="my-library-log-date">
                <time dateTime={log.readingDate}>{formatKoDateKey(log.readingDate)}</time>
              </td>
              <td className="my-library-log-num">
                {log.totalReadPages.toLocaleString()}쪽
                {log.books.length > 1 && <small> · {log.books.length}권</small>}
              </td>
              <td className="my-library-log-num">
                {log.status === 'REJECTED'
                  ? '반영 안 됨'
                  : formatPreciseDistance(log.convertedDistanceMeter)}
              </td>
              <td className="my-library-log-state">
                <span className={`log-status-badge status-${log.status}`}>
                  {READING_LOG_STATUS_LABELS[log.status]}
                </span>
              </td>
              <td className="my-library-log-arrow" aria-hidden="true">
                ›
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MyReadingLogsPage() {
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canWrite, setCanWrite] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showAllLogs, setShowAllLogs] = useState(false);

  useEffect(() => {
    let isActive = true;

    getCurrentParticipation()
      .then((participation) => {
        if (isActive) setCanWrite(canSubmitReadingLog(participation));
        return getMyReadingLogs(participation.participationId);
      })
      .then((nextLogs) => {
        if (isActive) {
          setLogs([...nextLogs].sort((a, b) => b.readingDate.localeCompare(a.readingDate)));
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setErrorMessage(getApiErrorMessage(error, '독서일지를 불러오지 못했습니다.'));
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const shelfBooks = useMemo(() => buildShelfBooks(logs), [logs]);
  const readingBooks = shelfBooks.filter(
    (book) => book.totalBookPages <= 0 || book.approvedPages < book.totalBookPages,
  );
  const completedBooks = shelfBooks.filter(
    (book) => book.totalBookPages > 0 && book.approvedPages >= book.totalBookPages,
  );
  const visibleLogs = showAllLogs ? logs : logs.slice(0, PREVIEW_LOG_COUNT);

  return (
    <main className="log-page my-library-page">
      <section className="my-library-hero">
        <h1>나의 서재</h1>
        {canWrite && (
          <Link to="/logs/new" className="log-primary-link">
            독서일지 작성
          </Link>
        )}
      </section>

      {isLoading ? (
        <div className="my-library-state">나의 서재를 불러오고 있습니다.</div>
      ) : errorMessage ? (
        <div className="my-library-state reading-log-error">{errorMessage}</div>
      ) : (
        <>
          <div className="my-library-summary" aria-label="나의 서재 요약">
            <div>
              <span>전체 도서</span>
              <strong>
                {shelfBooks.length}
                <small>권</small>
              </strong>
            </div>
            <div>
              <span>읽고 있는 책</span>
              <strong>
                {readingBooks.length}
                <small>권</small>
              </strong>
            </div>
            <div>
              <span>완독한 책</span>
              <strong>
                {completedBooks.length}
                <small>권</small>
              </strong>
            </div>
          </div>

          <div className="my-library-shelves">
            <BookShelf
              title="읽고 있는 책"
              books={readingBooks}
              emptyMessage="현재 읽고 있는 책이 없습니다."
            />
            <BookShelf
              title="완독한 책"
              books={completedBooks}
              emptyMessage="아직 완독한 책이 없습니다."
            />
          </div>

          <section className="my-library-recent" aria-labelledby="myLibraryRecentTitle">
            <div className="my-library-shelf-head">
              <h2 id="myLibraryRecentTitle">
                최근 독서일지
                <small>{logs.length.toLocaleString()}건</small>
              </h2>
              {logs.length > PREVIEW_LOG_COUNT && (
                <div className="my-library-shelf-actions">
                  <button
                    type="button"
                    className="my-library-more"
                    aria-expanded={showAllLogs}
                    onClick={() => setShowAllLogs((current) => !current)}
                  >
                    {showAllLogs ? '접기' : '전체 보기'}
                  </button>
                </div>
              )}
            </div>
            {visibleLogs.length === 0 ? (
              <p className="my-library-empty">아직 제출한 독서일지가 없습니다.</p>
            ) : (
              <RecentLogs logs={visibleLogs} />
            )}
          </section>
        </>
      )}
    </main>
  );
}

export default MyReadingLogsPage;
