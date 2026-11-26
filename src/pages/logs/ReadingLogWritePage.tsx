import ContentSkeleton from '../../components/layout/ContentSkeleton';
import { useAuth } from '../../auth';
import ReviewRecommendations from '../../components/layout/ReviewRecommendations';
import { previousReadingBookIds } from '../../utils/reviewRecommendations';
import ReviewGuide from '../../components/layout/ReviewGuide';
import { canSubmitReadingLog, hasFinalResults, koreaToday } from '../../utils/eventSelection';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/apiClient';
import BookCover from '../../components/logs/BookCover';
import BookSearchField from '../../components/logs/BookSearchField';
import { getCurrentParticipation, getMyParticipations } from '../../api/participationApi';
import {
  createReadingLog,
  getMyReadingBooks,
  getMyReadingLogs,
  getMyBookProgress,
  getMyReadingLog,
  getReviewTargetBooks,
  updateReadingLog,
} from '../../api/readingLogApi';
import type { BookSearchResult } from '../../types/book';
import type { MyParticipation } from '../../types/participation';
import type { ParticipantBook, ReadingLog, ReviewTargetBook } from '../../types/readingLog';
import { formatPreciseDistance, getProgressPercent, getCreditedPages } from '../../utils/reading';
import { METERS_PER_PAGE } from '../../constants/reading';
import { LEAVE_MESSAGE, useLeaveGuard } from '../../hooks/useLeaveGuard';
import { formatKoDateKey } from '../../utils/date';
import './logs.css';

type BookEntry = {
  id: number;
  selectedBook: BookSearchResult | null;
  query: string;
  readPages: string;
};

/**
 * 이탈 확인에 쓰는 입력 요약: 선택한 책과 입력한 쪽수만 봅니다. 검색창에 입력만 한 제목은
 * 도서 문의하기로 그대로 넘겨지므로, 그것만으로는 이탈 확인을 띄우지 않습니다.
 */
const entrySnapshot = (books: Pick<BookEntry, 'selectedBook' | 'readPages'>[]) =>
  JSON.stringify(
    books
      .map((book) => [book.selectedBook?.libraryBookId ?? null, book.readPages.trim()])
      .filter(([libraryBookId, readPages]) => libraryBookId !== null || readPages),
  );

const createBookEntry = (): BookEntry => ({
  id: Date.now() + Math.random(),
  selectedBook: null,
  query: '',
  readPages: '',
});

function ReadingLogWritePage() {
  const { logId } = useParams();
  return <ReadingLogEditor key={logId ?? 'new'} editingLogId={logId ? Number(logId) : null} />;
}
function ReadingLogEditor({ editingLogId }: { editingLogId: number | null }) {
  const { user } = useAuth();
  const [bookProgress, setBookProgress] = useState<ParticipantBook[]>([]);
  const [previousLogs, setPreviousLogs] = useState<ReadingLog[]>([]);
  const [guidanceWarning, setGuidanceWarning] = useState('');
  const navigate = useNavigate();
  const mounted = useRef(false);

  const today = koreaToday();
  const [participation, setParticipation] = useState<MyParticipation | null>(null);
  const participationId = participation?.participationId;
  // 독서 날짜는 고를 수 없습니다. 새 일지는 한국 시간 오늘, 수정은 저장된 날짜를 그대로 씁니다.
  const [readingDate, setReadingDate] = useState(today);
  // 불러온(또는 빈) 입력 상태. 수정 화면은 저장된 일지를 불러온 뒤 정합니다.
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(
    editingLogId ? null : entrySnapshot([]),
  );
  const [books, setBooks] = useState<BookEntry[]>([createBookEntry()]);
  const [reviewTargets, setReviewTargets] = useState<ReviewTargetBook[]>([]);
  const [currentReadingBook, setCurrentReadingBook] = useState<ParticipantBook | null>(null);
  const submitting = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  // 같은 날 이미 제출한 일지가 있어 제출이 거절된 경우(log는 찾은 기존 일지, 못 찾으면 null)
  const [duplicate, setDuplicate] = useState<{ log: ReadingLog | null } | null>(null);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    (async () => {
      const editingLog = editingLogId ? await getMyReadingLog(editingLogId) : null;
      if (editingLog?.status === 'APPROVED')
        throw new ApiError('승인된 독서일지는 수정할 수 없습니다.');
      if (editingLog?.bookRequestId)
        throw new ApiError(
          '도서 문의로 만들어진 일지입니다. 보완은 문의 게시판의 도서 문의에서 진행해 주세요.',
        );
      const participation = editingLog
        ? (await getMyParticipations()).find(
            (item) => item.participationId === editingLog.participationId,
          )
        : await getCurrentParticipation();
      if (!participation) throw new Error('해당 독서일지의 참가 정보를 찾을 수 없습니다.');
      if (!active) return;
      if (editingLog) {
        setReadingDate(editingLog.readingDate);
        setSavedSnapshot(
          entrySnapshot(
            editingLog.books.map((savedBook) => ({
              selectedBook: { libraryBookId: savedBook.libraryBookId } as BookSearchResult,
              readPages: String(savedBook.readPages),
            })),
          ),
        );
        setBooks(
          editingLog.books.map((savedBook) => ({
            id: savedBook.readingLogBookId,
            query: savedBook.bookTitle,
            readPages: String(savedBook.readPages),
            selectedBook: {
              libraryBookId: savedBook.libraryBookId,
              title: savedBook.bookTitle,
              author: savedBook.author,
              publisher: savedBook.publisher,
              isbn: savedBook.isbn,
              pageCount: savedBook.totalBookPages,
              callNo: savedBook.callNo,
              libraries: [],
              thumbnailUrl: savedBook.coverImageUrl,
            },
          })),
        );
      }
      setParticipation(participation);
      if (!canSubmitReadingLog(participation)) return;
      const results = await Promise.allSettled([
        getReviewTargetBooks(participation.eventId),
        getMyReadingBooks(participation.eventId),
        getMyBookProgress(participation.eventId),
        getMyReadingLogs(participation.participationId),
      ]);
      const [targets, readingBooks, progress, logs] = results;
      return {
        targets: targets.status === 'fulfilled' ? targets.value : [],
        readingBooks: readingBooks.status === 'fulfilled' ? readingBooks.value : [],
        progress: progress.status === 'fulfilled' ? progress.value : [],
        logs: logs.status === 'fulfilled' ? logs.value : [],
        guidanceUnavailable: results.some((result) => result.status === 'rejected'),
      };
    })()
      .then((result) => {
        if (!active || !result) return;
        const { targets, readingBooks, progress, logs, guidanceUnavailable } = result;
        setReviewTargets(targets);
        setBookProgress(progress);
        setPreviousLogs(logs);
        setGuidanceWarning(
          guidanceUnavailable
            ? '서평 안내 일부를 불러오지 못했습니다. 독서일지는 그대로 제출할 수 있습니다.'
            : '',
        );

        if (!editingLogId && readingBooks.length > 0) {
          const currentBook = readingBooks[0];
          setCurrentReadingBook(currentBook);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setErrorMessage(
          error instanceof ApiError ? error.message : '참가 정보를 불러오지 못했습니다.',
        );
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [editingLogId]);

  const dirty = savedSnapshot !== null && entrySnapshot(books) !== savedSnapshot;
  useLeaveGuard(dirty && !isSubmitting, LEAVE_MESSAGE);

  const updateBook = (id: number, changes: Partial<BookEntry>) => {
    setBooks((current) => current.map((book) => (book.id === id ? { ...book, ...changes } : book)));
  };

  const loadCurrentReadingBook = () => {
    if (!currentReadingBook) return;

    const selectedBook: BookSearchResult = {
      libraryBookId: currentReadingBook.libraryBookId,
      title: currentReadingBook.bookTitle,
      author: currentReadingBook.author,
      publisher: currentReadingBook.publisher,
      isbn: currentReadingBook.isbn,
      pageCount: currentReadingBook.totalBookPages,
      callNo: currentReadingBook.callNo,
      libraries: [],
      thumbnailUrl: currentReadingBook.coverImageUrl,
    };

    setBooks((current) => {
      if (current.some((book) => book.selectedBook?.libraryBookId === selectedBook.libraryBookId))
        return current;
      const emptyBook = current.find((book) => !book.selectedBook && !book.query.trim());
      if (emptyBook) {
        return current.map((book) =>
          book.id === emptyBook.id ? { ...book, query: selectedBook.title, selectedBook } : book,
        );
      }
      return [...current, { ...createBookEntry(), query: selectedBook.title, selectedBook }];
    });
  };

  const progressRate = participation
    ? Math.min(
        getProgressPercent(participation.totalDistanceMeter, participation.targetDistanceMeter),
        100,
      )
    : 0;
  const totalReadPages = books.reduce((sum, book) => sum + Number(book.readPages || 0), 0);
  const hasInvalidBook = books.some((book) => {
    const totalPages = book.selectedBook?.pageCount ?? 0;
    const readPages = Number(book.readPages);
    const matchedCurrentBook =
      currentReadingBook?.libraryBookId === book.selectedBook?.libraryBookId
        ? currentReadingBook
        : null;
    const availablePages = matchedCurrentBook?.remainingPages ?? totalPages;
    return !book.selectedBook || totalPages <= 0 || readPages <= 0 || readPages > availablePages;
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;

    if (!participation || !canSubmitReadingLog(participation)) {
      setErrorMessage('이 회차의 독서일지를 접수할 수 없습니다.');
      return;
    }
    if (!participationId || hasInvalidBook || totalReadPages > 400) {
      setErrorMessage(
        totalReadPages > 400
          ? '하루 최대 400페이지까지 입력할 수 있습니다.'
          : '도서를 선택하고 오늘 읽은 페이지를 확인해 주세요.',
      );
      return;
    }

    try {
      submitting.current = true;
      setIsSubmitting(true);
      setErrorMessage('');
      setDuplicate(null);
      const request = {
        readingDate,
        books: books.map((book) => ({
          libraryBookId: book.selectedBook!.libraryBookId,
          bookTitle: book.selectedBook!.title,
          author: book.selectedBook!.author,
          publisher: book.selectedBook!.publisher,
          isbn: book.selectedBook!.isbn,
          coverImageUrl: book.selectedBook!.thumbnailUrl,
          callNo: book.selectedBook!.callNo,
          totalBookPages: book.selectedBook!.pageCount!,
          readPages: Number(book.readPages),
        })),
      };
      const saved = editingLogId
        ? await updateReadingLog(editingLogId, request)
        : await createReadingLog(participationId, request);

      if (saved && mounted.current) navigate(`/logs/${saved.readingLogId}`);
    } catch (error) {
      if (
        !editingLogId &&
        error instanceof ApiError &&
        error.code === 'READING_LOG_ALREADY_EXISTS'
      ) {
        // 같은 날의 기존 일지를 찾아 수정 안내에 씁니다. 불러오지 못하면 이미 가진 목록으로 찾습니다.
        const sameDay = (log: ReadingLog) => log.readingDate === readingDate;
        const existing = await getMyReadingLogs(participationId)
          .then((logs) => logs.find(sameDay) ?? null)
          .catch(() => previousLogs.find(sameDay) ?? null);
        if (mounted.current) setDuplicate({ log: existing });
      } else {
        setErrorMessage(
          error instanceof ApiError ? error.message : '독서일지를 저장하지 못했습니다.',
        );
      }
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  if (participation && !canSubmitReadingLog(participation)) {
    return (
      <main className="page-container">
        <h1>{participation.eventTitle} 독서일지</h1>
        <p>
          {['CANCELLED', 'DISQUALIFIED'].includes(participation.participationStatus)
            ? '현재 참가 상태에서는 독서일지를 제출할 수 없습니다.'
            : `이 회차의 일지 접수가 닫혀 있습니다. 접수 기간은 ${participation.eventStartDate} ~ ${participation.eventEndDate}입니다.`}
        </p>
        <Link to="/logs">내 독서일지 보기</Link>
      </main>
    );
  }
  if (!participation && !errorMessage) {
    return (
      <main className="page-container reading-log-write">
        <section className="page-section">
          <h1>{editingLogId ? '독서일지 수정' : '독서일지 작성'}</h1>
          <p className="page-description">도서를 검색해 선택하고, 오늘 읽은 쪽수를 입력하세요.</p>
        </section>
        <div className="reading-workspace reading-log-write-layout">
          <section className="reading-log-card reading-log-write-main">
            <ContentSkeleton variant="form" label="참가 회차를 확인하고 있습니다." />
          </section>
          <aside className="reading-log-card">
            <ContentSkeleton variant="stats" label="참가 현황을 불러오고 있습니다." />
          </aside>
        </div>
      </main>
    );
  }
  if (!participation) {
    return (
      <main className="page-container">
        <h1>{editingLogId ? '독서일지 수정' : '독서일지 작성'}</h1>
        <p role="alert">{errorMessage}</p>
        <Link to="/logs">나의 서재</Link> <Link to="/inquiries?view=books">내 도서 문의</Link>
      </main>
    );
  }

  return (
    <main className="page-container reading-log-write">
      <section className="page-section">
        <h1>{editingLogId ? '독서일지 수정' : '독서일지 작성'}</h1>
        <p className="page-description">도서를 검색해 선택하고, 오늘 읽은 쪽수를 입력하세요.</p>
      </section>

      <div className="reading-workspace reading-log-write-layout">
        <section className="reading-log-card reading-log-write-main">
          <form onSubmit={handleSubmit}>
            {!editingLogId && currentReadingBook && (
              <div className="reading-current-book-guide">
                <span className="reading-current-book-guide-icon" aria-hidden="true">
                  ↗
                </span>
                <div>
                  <strong>읽던 책이 있어요</strong>
                  <p>
                    <b>{currentReadingBook.bookTitle}</b>을 이어서 읽었다면 바로 불러올 수 있어요.
                    다른 책을 자유롭게 검색해도 됩니다.
                  </p>
                </div>
                <dl>
                  <div>
                    <dt>지금까지 인정</dt>
                    <dd>{currentReadingBook.approvedReadPages.toLocaleString()}쪽</dd>
                  </div>
                  <div>
                    <dt>남은 페이지</dt>
                    <dd>{currentReadingBook.remainingPages.toLocaleString()}쪽</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="reading-current-book-load"
                  onClick={loadCurrentReadingBook}
                  disabled={books.some(
                    (book) => book.selectedBook?.libraryBookId === currentReadingBook.libraryBookId,
                  )}
                >
                  {books.some(
                    (book) => book.selectedBook?.libraryBookId === currentReadingBook.libraryBookId,
                  )
                    ? '불러옴'
                    : '읽던 책 불러오기'}
                </button>
              </div>
            )}
            <div className="reading-log-date-section">
              <p className="reading-log-date-display">
                <span>독서 날짜</span>
                <strong>
                  <time dateTime={readingDate}>{formatKoDateKey(readingDate)}</time>
                </strong>
                {editingLogId && <small>처음 기록한 독서일</small>}
              </p>
            </div>

            <div className="reading-book-list">
              {books.map((book, index) => {
                const totalPages = book.selectedBook?.pageCount ?? 0;
                const matchedCurrentBook =
                  !editingLogId &&
                  currentReadingBook?.libraryBookId === book.selectedBook?.libraryBookId
                    ? currentReadingBook
                    : null;
                const otherBooksPages = books.reduce(
                  (sum, item) => (item.id === book.id ? sum : sum + Number(item.readPages || 0)),
                  0,
                );
                const availablePages = Math.min(
                  matchedCurrentBook?.remainingPages ?? totalPages,
                  Math.max(0, 400 - otherBooksPages),
                );
                const readPages = Number(book.readPages || 0);
                const isPageInvalid = readPages > availablePages && availablePages > 0;

                return (
                  <section className="reading-book-row" key={book.id}>
                    <div className="reading-book-row-head">
                      <div className="reading-book-row-title">
                        <strong>책 {index + 1}</strong>
                        {book.selectedBook && (
                          <span className="reading-book-row-preview">
                            {book.selectedBook.title}
                          </span>
                        )}
                      </div>
                      {books.length > 1 && (
                        <button
                          type="button"
                          className="reading-book-remove"
                          onClick={() =>
                            setBooks((current) => current.filter((item) => item.id !== book.id))
                          }
                        >
                          삭제
                        </button>
                      )}
                    </div>

                    <div className="reading-book-entry-fields">
                      <BookSearchField
                        query={book.query}
                        selectedBook={book.selectedBook}
                        onQueryChange={(query) =>
                          updateBook(book.id, { query, selectedBook: null })
                        }
                        onSelect={(selectedBook) =>
                          updateBook(book.id, {
                            query: selectedBook.title,
                            selectedBook,
                          })
                        }
                      />

                      <label className="reading-log-field reading-book-read-pages">
                        <span>
                          오늘 읽은 페이지 <em>*</em>
                        </span>
                        <div className="reading-log-number-input">
                          <input
                            type="number"
                            min="1"
                            max={availablePages || undefined}
                            value={book.readPages}
                            onChange={(event) =>
                              updateBook(book.id, {
                                readPages: event.target.value,
                              })
                            }
                            placeholder={
                              book.selectedBook
                                ? `최대 ${availablePages.toLocaleString()}`
                                : '도서 선택 후 입력'
                            }
                            disabled={!book.selectedBook}
                            required
                          />
                          <span>쪽</span>
                        </div>
                        {isPageInvalid && (
                          <small className="reading-log-error">
                            남은 페이지 이하로 입력해 주세요.
                          </small>
                        )}
                      </label>
                    </div>

                    {book.selectedBook && (
                      <div className="reading-book-selected">
                        <span className="reading-book-selected-cover">
                          <BookCover book={book.selectedBook} />
                        </span>
                        <div className="reading-book-selected-info">
                          <span>선택한 도서</span>
                          <strong>{book.selectedBook.title}</strong>
                          <p>
                            {book.selectedBook.author || '저자 미상'}
                            {book.selectedBook.publisher ? ` · ${book.selectedBook.publisher}` : ''}
                          </p>
                          <dl>
                            <div>
                              <dt>전체 페이지</dt>
                              <dd>{totalPages.toLocaleString()}쪽</dd>
                            </div>
                            {matchedCurrentBook && (
                              <div>
                                <dt>독서 진행</dt>
                                <dd>
                                  {matchedCurrentBook.approvedReadPages.toLocaleString()} /{' '}
                                  {totalPages.toLocaleString()}쪽
                                </dd>
                              </div>
                            )}
                            {book.selectedBook.callNo && (
                              <div>
                                <dt>청구기호</dt>
                                <dd>{book.selectedBook.callNo}</dd>
                              </div>
                            )}
                          </dl>
                        </div>
                        <button
                          type="button"
                          className="reading-book-change"
                          onClick={() =>
                            updateBook(book.id, {
                              query: '',
                              selectedBook: null,
                            })
                          }
                        >
                          다른 책 선택
                        </button>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>

            <button
              type="button"
              className="reading-book-add"
              disabled={totalReadPages >= 400}
              onClick={() => setBooks((current) => [...current, createBookEntry()])}
            >
              <span aria-hidden="true">+</span>
              {totalReadPages >= 400
                ? '오늘 기록 가능한 400쪽을 모두 입력했어요'
                : '다른 책 추가하기'}
            </button>

            <div className="reading-log-summary">
              <div className="reading-log-summary-item">
                <span>오늘 읽은 페이지</span>
                <strong>{totalReadPages.toLocaleString()}쪽</strong>
              </div>
              <div className="reading-log-summary-item">
                <span>예상 환산 거리</span>
                <strong>{formatPreciseDistance(totalReadPages * METERS_PER_PAGE)}</strong>
              </div>
              <p>
                서평이 확인된 책은 일지 승인 즉시 1쪽당 5m가 반영됩니다. 처음 읽는 책은 담당자가
                서평을 확인한 뒤 반영됩니다.
              </p>
            </div>

            {duplicate && (
              // 중복 제출 안내: 서버·입력 오류(빨간색)와 구분되는 차분한 안내 영역
              <div className="reading-log-duplicate" role="alert">
                <svg
                  viewBox="0 0 16 16"
                  width="16"
                  height="16"
                  aria-hidden="true"
                  focusable="false"
                >
                  <circle cx="8" cy="8" r="6.5" />
                  <path d="M8 7.2v3.6M8 4.9v.2" />
                </svg>
                <div>
                  <strong>오늘 작성한 독서일지가 이미 있습니다.</strong>
                  {/* 기존 일지를 수정할 수 있는 상태일 때만 수정 안내를 보여 줍니다(상세 화면의 수정 조건과 같음). */}
                  {(() => {
                    const editable =
                      !!duplicate.log &&
                      duplicate.log.status !== 'APPROVED' &&
                      !duplicate.log.bookRequestId &&
                      !hasFinalResults(participation.eventStatus) &&
                      canSubmitReadingLog(participation);
                    return (
                      <>
                        <p>
                          독서일지는 하루에 한 번만 제출할 수 있습니다.
                          {editable && ' 추가 독서 기록은 기존 일지를 수정해 주세요.'}
                        </p>
                        {editable && duplicate.log && (
                          <Link to={`/logs/${duplicate.log.readingLogId}/edit`}>
                            기존 일지 수정하기 →
                          </Link>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            <div className="reading-log-actions">
              <div className="reading-log-action-message">
                {errorMessage ? (
                  <p className="reading-log-form-error" role="alert">
                    <span aria-hidden="true">!</span>
                    {errorMessage}
                  </p>
                ) : null}
              </div>
              <button
                className="reading-log-submit"
                type="submit"
                aria-busy={isSubmitting}
                disabled={isSubmitting || !!duplicate}
              >
                {isSubmitting ? '저장 중...' : editingLogId ? '독서일지 수정' : '독서일지 제출'}
              </button>
            </div>
          </form>
        </section>
        <aside className="reading-log-write-aside" aria-label="나의 기록과 서평 작성 안내">
          {participation && (
            <section className="reading-log-side-card">
              <div className="reading-log-side-head">
                <h2>나의 기록</h2>
                <Link to="/status">대회 현황 보기</Link>
              </div>
              <p className="reading-log-side-course">
                {participation.eventTitle} · {participation.courseName}
              </p>
              <dl className="reading-log-side-stats">
                <div>
                  <dt>일지 승인</dt>
                  <dd>{participation.totalPages.toLocaleString()}쪽</dd>
                </div>
                <div>
                  <dt>거리 인정</dt>
                  <dd>{getCreditedPages(participation.totalDistanceMeter).toLocaleString()}쪽</dd>
                </div>
                <div>
                  <dt>인정 거리</dt>
                  <dd>{formatPreciseDistance(participation.totalDistanceMeter)}</dd>
                </div>
              </dl>
              <div className="reading-log-side-progress">
                <div>
                  <span>목표 진행률</span>
                  <b>
                    {formatPreciseDistance(participation.totalDistanceMeter)} /{' '}
                    {formatPreciseDistance(participation.targetDistanceMeter)}
                  </b>
                </div>
                <div
                  className="reading-log-side-bar"
                  role="progressbar"
                  aria-label="목표 진행률"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressRate}
                >
                  <span style={{ width: `${progressRate}%` }} />
                </div>
                <small>목표 거리의 {progressRate}% 달성</small>
              </div>
            </section>
          )}

          <section className="reading-log-side-card reading-review-aside" id="review-guide">
            <h2>서평 작성 안내</h2>
            <ReviewGuide />
            {guidanceWarning && <p role="status">{guidanceWarning}</p>}
            {participationId && user && (
              <ReviewRecommendations
                key={`${user.userId}-${participationId}`}
                userId={user.userId}
                participationId={participationId}
                targets={reviewTargets}
                progress={bookProgress}
                previousBookIds={previousReadingBookIds(previousLogs, participationId, readingDate)}
                selectedBookIds={books.flatMap((b) =>
                  b.selectedBook ? [b.selectedBook.libraryBookId] : [],
                )}
              />
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

export default ReadingLogWritePage;
