import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '../../api/apiClient';
import { deleteReadingLog, getMyReadingLog } from '../../api/readingLogApi';
import {
  READING_LOG_STATUS_LABELS,
  type ReadingLog,
  type ReadingLogBook,
} from '../../types/readingLog';
import { formatDistance } from '../../utils/reading';
import './logs.css';

function DetailBookCover({ book }: { book: ReadingLogBook }) {
  if (book.coverImageUrl) {
    return <img src={book.coverImageUrl} alt={`${book.bookTitle} 표지`} />;
  }

  return (
    <span aria-hidden="true">
      <small>READING</small>
      BOOK
    </span>
  );
}

function ReadingLogDetailPage() {
  const { logId } = useParams();
  const navigate = useNavigate();
  const [log, setLog] = useState<ReadingLog | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const readingLogId = Number(logId);
  const hasValidReadingLogId = Number.isInteger(readingLogId) && readingLogId > 0;

  useEffect(() => {
    if (!hasValidReadingLogId) return;

    getMyReadingLog(readingLogId)
      .then(setLog)
      .catch((error: unknown) => {
        setErrorMessage(getApiErrorMessage(error, '독서일지를 불러오지 못했습니다.'));
      });
  }, [hasValidReadingLogId, readingLogId]);

  const handleDelete = async () => {
    if (!log || !window.confirm('이 독서일지를 삭제할까요?')) return;

    try {
      setIsDeleting(true);
      setErrorMessage('');
      await deleteReadingLog(log.readingLogId);
      navigate('/logs', { replace: true });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, '독서일지를 삭제하지 못했습니다.'));
      setIsDeleting(false);
    }
  };

  if (!log) {
    return (
      <main className="page-container">
        <section className="page-section">
          <p className="page-label">Reading Log</p>
          <h1>
            {!hasValidReadingLogId
              ? '독서일지 번호가 올바르지 않습니다.'
              : errorMessage || '독서일지를 불러오고 있습니다.'}
          </h1>
          <Link to="/logs" className="btn btn-secondary">
            목록으로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  const statusLabel = READING_LOG_STATUS_LABELS[log.status];

  return (
    <main className="reading-detail-page">
      <Link to="/logs" className="reading-detail-back">
        <span aria-hidden="true">←</span>
        나의 독서기록
      </Link>

      <section className="reading-detail-card">
        <header className="reading-detail-head">
          <div>
            <p className="page-label">Reading Log Detail</p>
            <h1>독서일지 상세</h1>
            <p>
              {log.readingDate} · {log.books.length}권 기록
            </p>
          </div>
          <span className={`log-status-badge status-${statusLabel}`}>{statusLabel}</span>
        </header>

        <dl className="reading-detail-summary">
          <div>
            <dt>읽은 책</dt>
            <dd>{log.books.length}권</dd>
          </div>
          <div>
            <dt>오늘 읽은 페이지</dt>
            <dd>{log.totalReadPages.toLocaleString()}쪽</dd>
          </div>
          <div>
            <dt>환산 거리</dt>
            <dd>{formatDistance(log.convertedDistanceMeter)}</dd>
          </div>
        </dl>

        <section className="reading-detail-books">
          <div className="reading-detail-section-head">
            <div>
              <p>Books</p>
              <h2>기록한 도서</h2>
            </div>
            <span>전체 페이지는 도서관 서지정보 기준입니다.</span>
          </div>

          <div className="reading-detail-book-list">
            {log.books.map((book, index) => {
              const progress = Math.min(
                Math.round((book.readPages / book.totalBookPages) * 100),
                100,
              );

              return (
                <article className="reading-detail-book" key={book.readingLogBookId}>
                  <div className="reading-detail-book-cover">
                    <DetailBookCover book={book} />
                  </div>
                  <div className="reading-detail-book-content">
                    <span className="reading-detail-book-number">
                      BOOK {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3>{book.bookTitle}</h3>
                    <p>
                      {book.author || '저자 미상'}
                      {book.publisher ? ` · ${book.publisher}` : ''}
                    </p>

                    <dl className="reading-detail-book-meta">
                      <div>
                        <dt>오늘 읽음</dt>
                        <dd>{book.readPages.toLocaleString()}쪽</dd>
                      </div>
                      <div>
                        <dt>전체 페이지</dt>
                        <dd>{book.totalBookPages.toLocaleString()}쪽</dd>
                      </div>
                      {book.callNo && (
                        <div>
                          <dt>청구기호</dt>
                          <dd>{book.callNo}</dd>
                        </div>
                      )}
                    </dl>

                    <div className="reading-detail-book-progress">
                      <div>
                        <span>이번 기록의 독서량</span>
                        <strong>{progress}%</strong>
                      </div>
                      <div className="reading-detail-book-track">
                        <span style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {log.adminComment && (
          <section className="reading-detail-comment">
            <span>관리자 검토 의견</span>
            <p>{log.adminComment}</p>
          </section>
        )}

        {errorMessage && (
          <p className="reading-log-form-error" role="alert">
            <span aria-hidden="true">!</span>
            {errorMessage}
          </p>
        )}

        <footer className="reading-detail-actions">
          <Link to="/logs" className="reading-detail-action-secondary">
            목록으로 돌아가기
          </Link>
          {log.status !== 'APPROVED' && (
            <div>
              <Link to={`/logs/${log.readingLogId}/edit`} className="reading-detail-action-primary">
                수정
              </Link>
              <button
                type="button"
                className="reading-detail-action-danger"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          )}
        </footer>
      </section>
    </main>
  );
}

export default ReadingLogDetailPage;
