import { useEffect, useState, type CSSProperties } from 'react';
import BookReviewActions from '../../components/logs/BookReviewActions';
import { METERS_PER_PAGE } from '../../constants/reading';
import { Link } from 'react-router-dom';
import { ApiError, getApiErrorMessage } from '../../api/apiClient';
import { getCurrentEvent } from '../../api/eventApi';
import { getCurrentParticipation } from '../../api/participationApi';
import { getMyBookProgress, getMyReadingLogs } from '../../api/readingLogApi';
import type { MyParticipation } from '../../types/participation';
import {
  READING_LOG_STATUS_LABELS,
  type ParticipantBook,
  type ReadingLog,
} from '../../types/readingLog';
import { formatDistance, getCreditedPages, getProgressRate } from '../../utils/reading';
import { formatKoDateKey } from '../../utils/date';
import { canApply, hasFinalResults } from '../../utils/eventSelection';
import './my.css';

function MyPage() {
  const [participation, setParticipation] = useState<MyParticipation | null>(null);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [readingBooks, setReadingBooks] = useState<ParticipantBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  // 참가 기록이 없는 경우(404 PARTICIPATION_NOT_FOUND)와 조회 실패를 구분해 안내합니다.
  const [isParticipationMissing, setIsParticipationMissing] = useState(false);
  const [isApplicationOpen, setIsApplicationOpen] = useState(false);
  const [isProgressStarted, setIsProgressStarted] = useState(false);

  useEffect(() => {
    let isActive = true;

    getCurrentParticipation()
      .then(async (nextParticipation) => {
        const [nextLogs, nextReadingBooks] = await Promise.all([
          getMyReadingLogs(nextParticipation.participationId),
          getMyBookProgress(nextParticipation.eventId),
        ]);
        if (isActive) {
          setParticipation(nextParticipation);
          setLogs(nextLogs);
          setReadingBooks(nextReadingBooks);
        }
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        if (error instanceof ApiError && error.code === 'PARTICIPATION_NOT_FOUND') {
          setIsParticipationMissing(true);
          // 참가신청 링크는 현재 행사가 실제로 신청을 받는 중일 때만 보여 줍니다.
          getCurrentEvent()
            .then((event) => {
              if (isActive) setIsApplicationOpen(canApply(event));
            })
            .catch(() => undefined);
          return;
        }
        setErrorMessage(getApiErrorMessage(error, '나의 현황을 불러오지 못했습니다.'));
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => setIsProgressStarted(true));
    return () => cancelAnimationFrame(frameId);
  }, [participation]);

  if (isLoading || !participation) {
    return (
      <main className="my-page">
        <section className="my-hero">
          <h1>나의 현황</h1>
          {isLoading && <p role="status">나의 현황을 불러오고 있습니다.</p>}
        </section>

        {!isLoading && isParticipationMissing && (
          <section className="my-empty" aria-labelledby="my-empty-title">
            <h2 id="my-empty-title">이 행사의 참가 정보가 없습니다.</h2>
            <p>참가가 승인된 행사의 코스 진행 상황과 독서 기록이 이곳에 표시됩니다.</p>
            {isApplicationOpen && <p>현재 참가신청을 받고 있습니다.</p>}
            <div className="my-empty__actions">
              {isApplicationOpen && (
                <Link to="/apply" className="btn btn-primary">
                  참가신청하기
                </Link>
              )}
              <Link to="/status" className="btn btn-secondary">
                대회 현황 보기
              </Link>
            </div>
          </section>
        )}

        {!isLoading && !isParticipationMissing && (
          <section className="my-empty" role="alert">
            <h2>나의 현황을 불러오지 못했습니다.</h2>
            <p>{errorMessage || '잠시 후 다시 시도해 주세요.'}</p>
            <div className="my-empty__actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => window.location.reload()}
              >
                다시 시도
              </button>
            </div>
          </section>
        )}
      </main>
    );
  }

  const progressRate = Math.min(
    getProgressRate(participation.totalDistanceMeter, participation.targetDistanceMeter),
    100,
  );
  const remainingDistance = Math.max(
    participation.targetDistanceMeter - participation.totalDistanceMeter,
    0,
  );
  const approvedCount = logs.filter((log) => log.status === 'APPROVED').length;
  const pendingCount = logs.filter((log) => log.status === 'SUBMITTED').length;
  const recentLog = [...logs].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )[0];
  const recentLogStatusLabel = recentLog ? READING_LOG_STATUS_LABELS[recentLog.status] : null;
  const progressStyle = {
    '--progress-position': isProgressStarted ? `${progressRate}%` : '0%',
  } as CSSProperties;

  return (
    <main className="my-page">
      <section className="my-hero">
        <h1>나의 현황</h1>
        <p>독서일지 승인과 서평 확인이 반영된 코스 진행 상황입니다.</p>
      </section>

      <section className="my-course-board">
        <div className="my-course-info">
          <span>현재 코스</span>
          <h2>{participation.courseName}</h2>
          <p>목표 거리 {formatDistance(participation.targetDistanceMeter)}</p>
        </div>
        <div className="my-progress-area" style={progressStyle}>
          <div className="my-progress-summary">
            <div>
              <span>현재 누적 거리</span>
              <strong>
                {formatDistance(participation.totalDistanceMeter)} /{' '}
                {formatDistance(participation.targetDistanceMeter)}
              </strong>
            </div>
            <b>{progressRate}%</b>
          </div>
          <div className="marathon-track" aria-label={`완주율 ${progressRate}%`}>
            <div className="marathon-track-labels">
              <span>0km</span>
              <span>{formatDistance(participation.targetDistanceMeter)}</span>
            </div>
            <div className="marathon-track-line">
              <div className="marathon-track-fill" />
              <div className="marathon-runner-marker" aria-hidden="true">
                <span className="runner-percent">{progressRate}%</span>
                <span className="runner-icon">●</span>
              </div>
              <div className="marathon-finish-marker" aria-hidden="true">
                ⚑
              </div>
            </div>
          </div>
          <p className="my-progress-caption">
            남은 거리 <strong>{formatDistance(remainingDistance)}</strong>
            {remainingDistance > 0 && (
              <> · {Math.ceil(remainingDistance / METERS_PER_PAGE).toLocaleString()}쪽 남음</>
            )}
          </p>
        </div>
      </section>

      <section className="my-stat-grid" aria-label="나의 독서마라톤 요약">
        <article>
          <span>거리 인정 쪽수</span>
          <strong>{getCreditedPages(participation.totalDistanceMeter).toLocaleString()}쪽</strong>
          <p>일지 승인 {participation.totalPages.toLocaleString()}쪽</p>
        </article>
        <article>
          <span>인정 거리</span>
          <strong>{formatDistance(participation.totalDistanceMeter)}</strong>
          <p>서평 확인을 거친 쪽수 × 5m</p>
        </article>
        <article>
          <span>승인 일지</span>
          <strong>{approvedCount}건</strong>
          <p>승인으로 쪽수가 확정된 기록</p>
        </article>
        <article>
          <span>검토 대기</span>
          <strong>{pendingCount}건</strong>
          <p>승인 대기 중인 기록</p>
        </article>
      </section>

      <section className="my-latest-section">
        <div className="my-section-head">
          <div>
            <h2>최근 제출한 독서일지</h2>
          </div>
          <Link to="/logs" className="my-outline-link">
            전체 기록 보기
          </Link>
        </div>
        {recentLog ? (
          <article className="my-latest-card">
            <div>
              <span className={`my-status-badge status-${recentLog.status}`}>
                {recentLogStatusLabel}
              </span>
              <h3>{recentLog.books.map((book) => book.bookTitle).join(', ')}</h3>
              <p>{recentLog.books.length}권의 독서 기록</p>
            </div>
            <dl>
              <div>
                <dt>독서 날짜</dt>
                <dd>{formatKoDateKey(recentLog.readingDate)}</dd>
              </div>
              <div>
                <dt>읽은 페이지</dt>
                <dd>{recentLog.totalReadPages.toLocaleString()}쪽</dd>
              </div>
              <div>
                <dt>예상 환산 거리</dt>
                <dd>
                  {recentLog.status === 'REJECTED'
                    ? '반영 안 됨'
                    : formatDistance(recentLog.convertedDistanceMeter)}
                </dd>
              </div>
            </dl>
          </article>
        ) : (
          <article className="my-latest-card">
            <p>아직 제출한 독서일지가 없습니다.</p>
          </article>
        )}
      </section>
      {readingBooks.length > 0 && (
        <section className="my-latest-section">
          <div className="my-section-head">
            <div>
              <h2>책별 독서·서평 현황</h2>
            </div>
          </div>
          {readingBooks.map((book) => (
            <article className="my-latest-card" key={book.participantBookId}>
              <div>
                <h3>{book.bookTitle}</h3>
                <p>
                  {book.author || '저자 미상'} · {book.publisher || '출판사 미상'}
                </p>
                <p>
                  {book.completed ? '완독' : '읽는 중'} ·{' '}
                  {book.reviewVerified
                    ? '서평 확인 완료'
                    : book.reviewCompleted
                      ? '서평 확인 대기'
                      : '서평 작성 필요'}{' '}
                  · 인정 거리 {formatDistance(book.creditedReadPages * METERS_PER_PAGE)}
                </p>
                {!hasFinalResults(participation.eventStatus) &&
                  ['APPROVED', 'COMPLETED'].includes(participation.participationStatus) &&
                  book.approvedReadPages > book.creditedReadPages &&
                  !book.reviewCompleted && (
                    <BookReviewActions
                      book={book}
                      onReported={(result) =>
                        setReadingBooks((current) =>
                          current.map((item) =>
                            item.participantBookId === result.participantBookId
                              ? { ...item, reviewCompleted: result.reviewCompleted }
                              : item,
                          ),
                        )
                      }
                    />
                  )}
              </div>
              <dl>
                <div>
                  <dt>승인된 페이지</dt>
                  <dd>{book.approvedReadPages.toLocaleString()}쪽</dd>
                </div>
                <div>
                  <dt>남은 페이지</dt>
                  <dd>{book.remainingPages.toLocaleString()}쪽</dd>
                </div>
              </dl>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

export default MyPage;
