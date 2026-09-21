import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '../../api/apiClient';
import { getCurrentParticipation } from '../../api/participationApi';
import {
  completeReview,
  createReadingLog,
  getMyReadingBooks,
  getMyReadingLog,
  getReviewTargetBooks,
  updateReadingLog,
} from '../../api/readingLogApi';
import BookCover from '../../components/logs/BookCover';
import BookSearchField from '../../components/logs/BookSearchField';
import {
  DAILY_READING_PAGE_LIMIT,
  METERS_PER_PAGE,
} from '../../constants/reading';
import type { BookSearchResult } from '../../types/book';
import type {
  ParticipantBook,
  ReadingLogBookRequest,
  ReadingLogRequest,
  ReviewTargetBook,
} from '../../types/readingLog';
import './logs.css';

type BookEntry = {
  id: number;
  selectedBook: BookSearchResult | null;
  query: string;
  readPages: string;
};

/** 독서일지·읽던 책에 저장된 도서 정보를 검색 결과와 같은 형태로 맞춥니다. */
type SavedBook = Pick<
  ReadingLogBookRequest,
  | 'libraryBookId'
  | 'bookTitle'
  | 'author'
  | 'publisher'
  | 'isbn'
  | 'callNo'
  | 'totalBookPages'
  | 'coverImageUrl'
>;

const createBookEntry = (): BookEntry => ({
  id: Date.now() + Math.random(),
  selectedBook: null,
  query: '',
  readPages: '',
});

function toBookSearchResult(book: SavedBook): BookSearchResult {
  return {
    libraryBookId: book.libraryBookId,
    title: book.bookTitle,
    author: book.author,
    publisher: book.publisher,
    isbn: book.isbn,
    pageCount: book.totalBookPages,
    callNo: book.callNo,
    libraries: [],
    thumbnailUrl: book.coverImageUrl,
  };
}

function toBookRequest(book: BookEntry): ReadingLogBookRequest {
  const selectedBook = book.selectedBook!;

  return {
    libraryBookId: selectedBook.libraryBookId,
    bookTitle: selectedBook.title,
    author: selectedBook.author,
    publisher: selectedBook.publisher,
    isbn: selectedBook.isbn,
    coverImageUrl: selectedBook.thumbnailUrl,
    callNo: selectedBook.callNo,
    totalBookPages: selectedBook.pageCount!,
    readPages: Number(book.readPages),
  };
}

function ReadingLogWritePage() {
  const navigate = useNavigate();
  const { logId } = useParams();
  const editingLogId = logId ? Number(logId) : null;
  const today = new Date().toISOString().slice(0, 10);
  const [participationId, setParticipationId] = useState<number | null>(null);
  const [readingDate, setReadingDate] = useState(today);
  const [books, setBooks] = useState<BookEntry[]>([createBookEntry()]);
  const [reviewTargets, setReviewTargets] = useState<ReviewTargetBook[]>([]);
  const [currentReadingBook, setCurrentReadingBook] = useState<ParticipantBook | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    Promise.all([
      getCurrentParticipation(),
      getReviewTargetBooks(),
      getMyReadingBooks(),
      editingLogId ? getMyReadingLog(editingLogId) : Promise.resolve(null),
    ])
      .then(([participation, targets, readingBooks, editingLog]) => {
        setParticipationId(participation.participationId);
        setReviewTargets(targets);

        if (editingLog) {
          setReadingDate(editingLog.readingDate);
          setBooks(
            editingLog.books.map((savedBook) => ({
              id: savedBook.readingLogBookId,
              query: savedBook.bookTitle,
              readPages: String(savedBook.readPages),
              selectedBook: toBookSearchResult(savedBook),
            })),
          );
        } else if (readingBooks.length > 0) {
          setCurrentReadingBook(readingBooks[0]);
        }
      })
      .catch((error: unknown) => {
        setErrorMessage(
          getApiErrorMessage(error, '참가 정보를 불러오지 못했습니다.'),
        );
      });
  }, [editingLogId]);

  const updateBook = (id: number, changes: Partial<BookEntry>) => {
    setBooks((current) =>
      current.map((book) =>
        book.id === id ? { ...book, ...changes } : book,
      ),
    );
  };

  const loadCurrentReadingBook = () => {
    if (!currentReadingBook) return;

    const selectedBook = toBookSearchResult(currentReadingBook);

    setBooks((current) => {
      if (current.some((book) => book.selectedBook?.libraryBookId === selectedBook.libraryBookId)) return current;
      const emptyBook = current.find((book) => !book.selectedBook && !book.query.trim());
      if (emptyBook) {
        return current.map((book) => book.id === emptyBook.id
          ? { ...book, query: selectedBook.title, selectedBook }
          : book);
      }
      return [...current, { ...createBookEntry(), query: selectedBook.title, selectedBook }];
    });
  };

  const handleReviewComplete = async (target: ReviewTargetBook) => {
    try {
      await completeReview(target.participantBookId);
      setReviewTargets((current) =>
        current.filter(
          (item) => item.participantBookId !== target.participantBookId,
        ),
      );
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, '서평 완료 처리에 실패했습니다.'),
      );
    }
  };

  const totalReadPages = books.reduce(
    (sum, book) => sum + Number(book.readPages || 0),
    0,
  );
  const hasInvalidBook = books.some((book) => {
    const totalPages = book.selectedBook?.pageCount ?? 0;
    const readPages = Number(book.readPages);
    const matchedCurrentBook = currentReadingBook?.libraryBookId === book.selectedBook?.libraryBookId
      ? currentReadingBook
      : null;
    const availablePages = matchedCurrentBook?.remainingPages ?? totalPages;
    return !book.selectedBook || totalPages <= 0 || readPages <= 0 || readPages > availablePages;
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !participationId ||
      hasInvalidBook ||
      totalReadPages > DAILY_READING_PAGE_LIMIT
    ) {
      setErrorMessage(
        totalReadPages > DAILY_READING_PAGE_LIMIT
          ? `하루 최대 ${DAILY_READING_PAGE_LIMIT}페이지까지 입력할 수 있습니다.`
          : '도서를 선택하고 오늘 읽은 페이지를 확인해 주세요.',
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');
      const request: ReadingLogRequest = {
        readingDate,
        books: books.map(toBookRequest),
      };
      const saved = editingLogId
        ? await updateReadingLog(editingLogId, request)
        : await createReadingLog(participationId, request);

      if (saved) navigate(`/logs/${saved.readingLogId}`);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, '독서일지를 저장하지 못했습니다.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page-container reading-log-write">
      <section className="page-section">
        <p className="page-label">Reading Log</p>
        <h1>{editingLogId ? '독서일지 수정' : '독서일지 작성'}</h1>
        <p className="page-description">
          도서관 소장 도서를 검색한 뒤 오늘 읽은 페이지만 기록해 주세요.
        </p>
      </section>

      {reviewTargets.length > 0 && (
        <section className="reading-log-card">
          <h2>먼저 서평을 완료해 주세요</h2>
          <p>완독한 책의 서평 완료 처리 후 새 독서일지를 제출할 수 있습니다.</p>
          {reviewTargets.map((target) => (
            <div className="reading-book-row" key={target.participantBookId}>
              <strong>{target.bookTitle}</strong>
              <div className="reading-detail-actions">
                <a
                  className="btn btn-secondary"
                  href={target.reviewSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  서평 작성하러 가기
                </a>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleReviewComplete(target)}
                >
                  작성 완료
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="reading-log-card">
        <form onSubmit={handleSubmit}>
          {!editingLogId && currentReadingBook && (
            <div className="reading-current-book-guide">
              <span className="reading-current-book-guide-icon" aria-hidden="true">↗</span>
              <div>
                <strong>읽던 책이 있어요</strong>
                <p><b>{currentReadingBook.bookTitle}</b>을 이어서 읽었다면 바로 불러올 수 있어요. 다른 책을 자유롭게 검색해도 됩니다.</p>
              </div>
              <dl>
                <div><dt>지금까지 인정</dt><dd>{currentReadingBook.approvedReadPages.toLocaleString()}쪽</dd></div>
                <div><dt>남은 페이지</dt><dd>{currentReadingBook.remainingPages.toLocaleString()}쪽</dd></div>
              </dl>
              <button
                type="button"
                className="reading-current-book-load"
                onClick={loadCurrentReadingBook}
                disabled={books.some((book) => book.selectedBook?.libraryBookId === currentReadingBook.libraryBookId)}
              >
                {books.some((book) => book.selectedBook?.libraryBookId === currentReadingBook.libraryBookId) ? '불러옴' : '읽던 책 불러오기'}
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
                value={readingDate}
                onChange={(event) => setReadingDate(event.target.value)}
                required
              />
            </label>
          </div>

          <div className="reading-book-list">
            {books.map((book, index) => {
              const totalPages = book.selectedBook?.pageCount ?? 0;
              const matchedCurrentBook = !editingLogId && currentReadingBook?.libraryBookId === book.selectedBook?.libraryBookId
                ? currentReadingBook
                : null;
              const otherBooksPages = books.reduce(
                (sum, item) => item.id === book.id ? sum : sum + Number(item.readPages || 0),
                0,
              );
              const availablePages = Math.min(
                matchedCurrentBook?.remainingPages ?? totalPages,
                Math.max(0, DAILY_READING_PAGE_LIMIT - otherBooksPages),
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
                          setBooks((current) =>
                            current.filter((item) => item.id !== book.id),
                          )
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
                        updateBook(book.id, { query: selectedBook.title, selectedBook })
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
                          {book.selectedBook.publisher
                            ? ` · ${book.selectedBook.publisher}`
                            : ''}
                        </p>
                        <dl>
                          <div>
                            <dt>전체 페이지</dt>
                            <dd>{totalPages.toLocaleString()}쪽</dd>
                          </div>
                          {matchedCurrentBook && (
                            <div><dt>독서 진행</dt><dd>{matchedCurrentBook.approvedReadPages.toLocaleString()} / {totalPages.toLocaleString()}쪽</dd></div>
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
            disabled={totalReadPages >= DAILY_READING_PAGE_LIMIT}
            onClick={() =>
              setBooks((current) => [...current, createBookEntry()])
            }
          >
            <span aria-hidden="true">+</span>
            {totalReadPages >= DAILY_READING_PAGE_LIMIT
              ? `오늘 기록 가능한 ${DAILY_READING_PAGE_LIMIT}쪽을 모두 입력했어요`
              : '다른 책 추가하기'}
          </button>

          <div className="reading-log-summary">
            <div className="reading-log-summary-item">
              <span>오늘 읽은 페이지</span>
              <strong>{totalReadPages.toLocaleString()}쪽</strong>
            </div>
            <div className="reading-log-summary-item">
              <span>환산 거리</span>
              <strong>{(totalReadPages * METERS_PER_PAGE).toLocaleString()}m</strong>
            </div>
            <p>읽은 페이지는 1쪽당 5m로 자동 환산됩니다.</p>
          </div>

          <div className="reading-log-actions">
            <div className="reading-log-action-message">
              {errorMessage ? (
                <p className="reading-log-form-error" role="alert">
                  <span aria-hidden="true">!</span>
                  {errorMessage}
                </p>
              ) : (
                <p>도서와 페이지를 확인한 뒤 제출해 주세요.</p>
              )}
            </div>
            <button
              className="reading-log-submit"
              type="submit"
              disabled={
                isSubmitting || (!editingLogId && reviewTargets.length > 0)
              }
            >
              {isSubmitting
                ? '저장 중...'
                : editingLogId
                  ? '독서일지 수정'
                  : '독서일지 제출'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default ReadingLogWritePage;
