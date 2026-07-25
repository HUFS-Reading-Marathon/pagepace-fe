import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import './logs.css';

type BookEntry = {
  id: number;
  title: string;
  totalPages: string;
  readPages: string;
  memo: string;
};

const createBookEntry = (): BookEntry => ({
  id: Date.now() + Math.random(),
  title: '',
  totalPages: '',
  readPages: '',
  memo: '',
});

function ReadingLogWritePage() {
  const today = new Date().toISOString().slice(0, 10);

  const [readingDate, setReadingDate] = useState(today);
  const [books, setBooks] = useState<BookEntry[]>([createBookEntry()]);

  const updateBook = (
    id: number,
    field: keyof Omit<BookEntry, 'id'>,
    value: string,
  ) => {
    setBooks((currentBooks) =>
      currentBooks.map((book) =>
        book.id === id ? { ...book, [field]: value } : book,
      ),
    );
  };

  const addBook = () => {
    setBooks((currentBooks) => [...currentBooks, createBookEntry()]);
  };

  const removeBook = (id: number) => {
    setBooks((currentBooks) => {
      if (currentBooks.length === 1) {
        return currentBooks;
      }

      return currentBooks.filter((book) => book.id !== id);
    });
  };

  const isBookPageCountInvalid = (book: BookEntry) => {
    const numericTotalPages = Number(book.totalPages || 0);
    const numericReadPages = Number(book.readPages || 0);

    return (
      numericTotalPages > 0 &&
      numericReadPages > 0 &&
      numericReadPages > numericTotalPages
    );
  };

  const hasInvalidBook = books.some(isBookPageCountInvalid);

  const totalReadPages = books.reduce(
    (sum, book) => sum + Number(book.readPages || 0),
    0,
  );

  const convertedDistance = totalReadPages * 5;

  const formattedDistance =
    convertedDistance >= 1000
      ? `${(convertedDistance / 1000).toFixed(2)}km`
      : `${convertedDistance.toLocaleString()}m`;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (hasInvalidBook) {
      alert('오늘 읽은 페이지는 책 전체 페이지보다 클 수 없습니다.');
      return;
    }

    alert('독서일지 제출 기능은 API 연동 후 연결될 예정입니다.');
  };

  return (
    <main className="page-container reading-log-write">
      <section className="page-section">
        <p className="page-label">Reading Log</p>

        <h1>독서일지 작성</h1>

        <p className="page-description">
          오늘 읽은 책과 페이지 수를 간단히 기록해 주세요.
          <br />
          여러 권을 읽었다면 책을 추가할 수 있으며, 읽은 페이지는 1쪽당
          5m로 자동 환산됩니다.
        </p>
      </section>

      <section className="reading-log-card">
        <form onSubmit={handleSubmit}>
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
              const isInvalid = isBookPageCountInvalid(book);

              return (
                <section className="reading-book-row" key={book.id}>
                  <div className="reading-book-row-head">
                    <div className="reading-book-row-title">
                      <strong>책 {index + 1}</strong>

                      {book.title && (
                        <span className="reading-book-row-preview">
                          {book.title}
                        </span>
                      )}
                    </div>

                    {books.length > 1 && (
                      <button
                        type="button"
                        className="reading-book-remove"
                        onClick={() => removeBook(book.id)}
                        aria-label={`책 ${index + 1} 삭제`}
                      >
                        삭제
                      </button>
                    )}
                  </div>

                  <div className="reading-book-fields">
                    <label className="reading-log-field reading-book-title-field">
                      <span>
                        책 제목 <em>*</em>
                      </span>

                      <input
                        type="text"
                        value={book.title}
                        onChange={(event) =>
                          updateBook(book.id, 'title', event.target.value)
                        }
                        placeholder="오늘 읽은 책 제목을 입력하세요"
                        required
                      />
                    </label>

                    <label className="reading-log-field">
                      <span>
                        책 전체 페이지 <em>*</em>
                      </span>

                      <div className="reading-log-number-input">
                        <input
                          type="number"
                          min="1"
                          value={book.totalPages}
                          onChange={(event) =>
                            updateBook(
                              book.id,
                              'totalPages',
                              event.target.value,
                            )
                          }
                          placeholder="예: 320"
                          required
                        />

                        <span>쪽</span>
                      </div>
                    </label>

                    <label className="reading-log-field">
                      <span>
                        오늘 읽은 페이지 <em>*</em>
                      </span>

                      <div className="reading-log-number-input">
                        <input
                          type="number"
                          min="1"
                          value={book.readPages}
                          onChange={(event) =>
                            updateBook(
                              book.id,
                              'readPages',
                              event.target.value,
                            )
                          }
                          placeholder="예: 45"
                          required
                        />

                        <span>쪽</span>
                      </div>

                      {isInvalid && (
                        <small className="reading-log-error">
                          책 전체 페이지 이하로 입력해 주세요.
                        </small>
                      )}
                    </label>
                  </div>

                  <label className="reading-book-memo">
                    <span>
                      간단한 메모
                      <small>선택</small>
                    </span>

                    <input
                      type="text"
                      value={book.memo}
                      onChange={(event) =>
                        updateBook(book.id, 'memo', event.target.value)
                      }
                      placeholder="기억하고 싶은 내용이 있다면 짧게 남겨보세요."
                    />
                  </label>
                </section>
              );
            })}
          </div>

          <button
            type="button"
            className="reading-book-add"
            onClick={addBook}
          >
            <span aria-hidden="true">+</span>
            다른 책 추가하기
          </button>

          <p className="reading-log-memo-guide">
            메모는 선택 사항이며 작성 여부는 독서일지 승인에 영향을 주지
            않습니다.
          </p>

          <div className="reading-log-summary">
            <div className="reading-log-summary-item">
              <span>읽은 책</span>
              <strong>{books.length}권</strong>
            </div>

            <div className="reading-log-summary-divider" />

            <div className="reading-log-summary-item">
              <span>오늘 총 독서량</span>
              <strong>{totalReadPages.toLocaleString()}쪽</strong>
            </div>

            <div className="reading-log-summary-divider" />

            <div className="reading-log-summary-item">
              <span>오늘의 환산 거리</span>
              <strong>{formattedDistance}</strong>
            </div>

            <p>입력한 모든 책의 오늘 읽은 페이지 × 5m</p>
          </div>

          <div className="form-actions reading-log-actions">
            <Link to="/logs" className="btn btn-secondary">
              내 기록 보기
            </Link>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={hasInvalidBook}
            >
              기록 제출하기
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default ReadingLogWritePage;