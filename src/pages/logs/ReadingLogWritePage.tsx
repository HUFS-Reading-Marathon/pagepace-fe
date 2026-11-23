import { useAuth } from '../../auth';
import ReviewRecommendations from '../../components/layout/ReviewRecommendations';
import { previousReadingBookIds } from '../../utils/reviewRecommendations';
import ReviewGuide from '../../components/layout/ReviewGuide';
import { canSubmitReadingLog, koreaToday } from '../../utils/eventSelection';
import { type FormEvent, useEffect, useState } from 'react';
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
import { formatDistance, getProgressPercent, getCreditedPages } from '../../utils/reading';
import { METERS_PER_PAGE } from '../../constants/reading';
import './logs.css';

type BookEntry = {
  id: number;
  selectedBook: BookSearchResult | null;
  query: string;
  readPages: string;
};

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

  const today = koreaToday();
  const [participation, setParticipation] = useState<MyParticipation | null>(null);
  const participationId = participation?.participationId;
  const [readingDate, setReadingDate] = useState(today);
  const [books, setBooks] = useState<BookEntry[]>([createBookEntry()]);
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewTargets, setReviewTargets] = useState<ReviewTargetBook[]>([]);
  const [currentReadingBook, setCurrentReadingBook] = useState<ParticipantBook | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const editingLog = editingLogId ? await getMyReadingLog(editingLogId) : null;
      if (editingLog?.status === 'APPROVED')
        throw new ApiError('승인된 독서일지는 수정할 수 없습니다.');
      if (editingLog?.bookRequestId)
        throw new ApiError(
          '도서 확인으로 이관한 일지입니다. 보완은 도서 확인 요청에서 진행해 주세요.',
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
    };
  }, [editingLogId]);

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

  const handleReviewComplete = (result: ReviewTargetBook) => {
    setReviewMessage(
      `“${result.bookTitle}” 서평 확인을 요청했습니다. 담당자 확인 후 거리가 반영됩니다.`,
    );
    setReviewTargets((current) =>
      current.filter((book) => book.participantBookId !== result.participantBookId),
    );
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
      setIsSubmitting(true);
      setErrorMessage('');
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

      if (saved) navigate(`/logs/${saved.readingLogId}`);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : '독서일지를 저장하지 못했습니다.',
      );
    } finally {
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
  if (!participation) {
    return (
      <main className="page-container">
        <h1>{editingLogId ? '독서일지 수정' : '독서일지 작성'}</h1>
        <p role={errorMessage ? 'alert' : 'status'}>
          {errorMessage || '참가 회차를 확인하고 있습니다.'}
        </p>
        <Link to="/logs">나의 서재</Link> <Link to="/book-requests">내 도서 확인 요청</Link>
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
              <label className="reading-log-field reading-log-date-field">
                <span>
                  독서 날짜 <em>*</em>
                </span>
                <input
                  type="date"
                  min={participation?.eventStartDate}
                  max={
                    participation && participation.eventEndDate < today
                      ? participation.eventEndDate
                      : today
                  }
                  value={readingDate}
                  onChange={(event) => setReadingDate(event.target.value)}
                  required
                />
              </label>
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
                <strong>{formatDistance(totalReadPages * METERS_PER_PAGE)}</strong>
              </div>
              <p>
                서평이 확인된 책은 일지 승인 즉시 1쪽당 5m가 반영됩니다. 처음 읽는 책은 담당자가
                서평을 확인한 뒤 반영됩니다.
              </p>
            </div>

            <div className="reading-log-actions">
              <div className="reading-log-action-message">
                {errorMessage ? (
                  <p className="reading-log-form-error" role="alert">
                    <span aria-hidden="true">!</span>
                    {errorMessage}
                  </p>
                ) : null}
              </div>
              <button className="reading-log-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? '저장 중...' : editingLogId ? '독서일지 수정' : '독서일지 제출'}
              </button>
            </div>
          </form>
        </section>
        <aside className="reading-log-write-aside" aria-label="나의 기록과 서평 할 일">
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
                  <dd>{formatDistance(participation.totalDistanceMeter)}</dd>
                </div>
              </dl>
              <div className="reading-log-side-progress">
                <div>
                  <span>목표 진행률</span>
                  <b>
                    {formatDistance(participation.totalDistanceMeter)} /{' '}
                    {formatDistance(participation.targetDistanceMeter)}
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
            <h2>서평 할 일</h2>
            <ReviewGuide />
            <p role="status">{reviewMessage}</p>
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
                onReported={handleReviewComplete}
              />
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

export default ReadingLogWritePage;
