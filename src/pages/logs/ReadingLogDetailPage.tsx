import ContentSkeleton from '../../components/layout/ContentSkeleton';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '../../api/apiClient';
import { getMyParticipations } from '../../api/participationApi';
import type { MyParticipation } from '../../types/participation';
import { canSubmitReadingLog, hasFinalResults } from '../../utils/eventSelection';
import { deleteReadingLog, getMyReadingLog } from '../../api/readingLogApi';
import {
  READING_LOG_STATUS_LABELS,
  type ReadingLog,
  type ReadingLogBook,
} from '../../types/readingLog';
import { formatPreciseDistance } from '../../utils/reading';
import { formatKoDateKey } from '../../utils/date';
import './logs.css';

function DetailBookCover({ book }: { book: ReadingLogBook }) {
  if (book.coverImageUrl) {
    return <img src={book.coverImageUrl} alt={`${book.bookTitle} 표지`} />;
  }

  return <span aria-hidden="true">표지 없음</span>;
}

function ReadingLogDetailPage() {
  const { logId } = useParams();
  return <ReadingLogDetail key={logId} readingLogId={Number(logId)} />;
}

function ReadingLogDetail({ readingLogId }: { readingLogId: number }) {
  const navigate = useNavigate();
  const mounted = useRef(false);
  const deleting = useRef(false);
  const [log, setLog] = useState<ReadingLog | null>(null);
  const [participation, setParticipation] = useState<MyParticipation>();
  const [errorMessage, setErrorMessage] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const hasValidReadingLogId = Number.isInteger(readingLogId) && readingLogId > 0;

  useEffect(() => {
    if (!hasValidReadingLogId) return;

    let active = true;
    mounted.current = true;
    getMyReadingLog(readingLogId)
      .then(async (entry) => {
        if (!active) return;
        setLog(entry);
        if (entry.status === 'APPROVED' || entry.bookRequestId) return;
        const participations = await getMyParticipations();
        if (active)
          setParticipation(
            participations.find((item) => item.participationId === entry.participationId),
          );
      })
      .catch((error: unknown) => {
        if (active) setErrorMessage(getApiErrorMessage(error, '독서일지를 불러오지 못했습니다.'));
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [hasValidReadingLogId, readingLogId]);

  const handleDelete = async () => {
    if (!log || deleting.current || !window.confirm('이 독서일지를 삭제할까요?')) return;

    try {
      deleting.current = true;
      setIsDeleting(true);
      setErrorMessage('');
      await deleteReadingLog(log.readingLogId);
      if (mounted.current) navigate('/logs', { replace: true });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, '독서일지를 삭제하지 못했습니다.'));
      deleting.current = false;
      setIsDeleting(false);
    }
  };

  if (!log && hasValidReadingLogId && !errorMessage) {
    return (
      <main className="reading-detail-page">
        <section className="reading-detail-card">
          <header className="reading-detail-head">
            <h1>독서일지 상세</h1>
          </header>
          <ContentSkeleton variant="detail" label="독서일지를 불러오고 있습니다." />
        </section>
      </main>
    );
  }
  if (!log) {
    return (
      <main className="page-container">
        <section className="page-section">
          <h1>{!hasValidReadingLogId ? '독서일지 번호가 올바르지 않습니다.' : errorMessage}</h1>
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
      <section className="reading-detail-card">
        <header className="reading-detail-head">
          <h1>독서일지 상세</h1>
          <span className={`log-status-badge status-${log.status}`}>{statusLabel}</span>
          <p>
            {formatKoDateKey(log.readingDate)} · {log.books.length}권 기록
          </p>
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
            <dt>예상 환산 거리</dt>
            <dd>
              {log.status === 'REJECTED'
                ? '반영 안 됨'
                : formatPreciseDistance(log.convertedDistanceMeter)}
            </dd>
          </div>
        </dl>

        <section className="reading-detail-books">
          <div className="reading-detail-section-head">
            <h2>기록한 도서</h2>
          </div>

          <div className="reading-detail-book-list">
            {log.books.map((book) => {
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
                    <h3>{book.bookTitle}</h3>
                    <p>
                      {book.author || '저자 미상'}
                      {book.publisher ? ` · ${book.publisher}` : ''}
                    </p>

                    {book.callNo && (
                      <p className="reading-detail-book-callno">청구기호 {book.callNo}</p>
                    )}

                    <div className="reading-detail-book-progress">
                      <div>
                        <span>독서량</span>
                        <strong>
                          {book.readPages.toLocaleString()}쪽 /{' '}
                          {book.totalBookPages.toLocaleString()}쪽
                        </strong>
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
          <p className="reading-detail-note">전체 페이지는 도서관 서지정보 기준입니다.</p>
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
          <Link to="/logs" className="reading-detail-back-link">
            <span aria-hidden="true">←</span>
            목록으로 돌아가기
          </Link>
          {log.bookRequestId && (
            <Link to="/inquiries?view=books" className="reading-detail-action-secondary">
              도서 문의 내역
            </Link>
          )}
          {log.status !== 'APPROVED' &&
            !log.bookRequestId &&
            participation?.participationId === log.participationId &&
            !hasFinalResults(participation.eventStatus) && (
              <div>
                {canSubmitReadingLog(participation) && (
                  <Link
                    to={`/logs/${log.readingLogId}/edit`}
                    className="reading-detail-action-primary"
                  >
                    수정
                  </Link>
                )}
                <button
                  type="button"
                  className="reading-detail-action-danger"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  aria-busy={isDeleting}
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
