import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/apiClient';
import { getCurrentParticipation } from '../../api/participationApi';
import { getMyReadingBooks, getMyReadingLogs } from '../../api/readingLogApi';
import type { MyParticipation } from '../../types/participation';
import type { ParticipantBook, ReadingLog } from '../../types/readingLog';
import { formatDistance } from '../../utils/reading';
import './my.css';

const STATUS_LABEL = {
  SUBMITTED: '검토중',
  APPROVED: '인정',
  REJECTED: '반려',
} as const;

function MyPage() {
  const [participation, setParticipation] = useState<MyParticipation | null>(null);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [readingBooks, setReadingBooks] = useState<ParticipantBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isProgressStarted, setIsProgressStarted] = useState(false);

  useEffect(() => {
    let isActive = true;

    getCurrentParticipation()
      .then(async (nextParticipation) => {
        const [nextLogs, nextReadingBooks] = await Promise.all([
          getMyReadingLogs(nextParticipation.participationId),
          getMyReadingBooks(),
        ]);
        if (isActive) {
          setParticipation(nextParticipation);
          setLogs(nextLogs);
          setReadingBooks(nextReadingBooks);
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setErrorMessage(
            error instanceof ApiError
              ? error.message
              : '나의 현황을 불러오지 못했습니다.',
          );
        }
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
          <p className="my-label">My Status</p>
          <h1>{errorMessage || '나의 현황을 불러오고 있습니다.'}</h1>
        </section>
      </main>
    );
  }

  const progressRate = Math.min(Math.round(participation.progressRate), 100);
  const remainingDistance = Math.max(
    participation.targetDistanceMeter - participation.totalDistanceMeter,
    0,
  );
  const approvedCount = logs.filter((log) => log.status === 'APPROVED').length;
  const pendingCount = logs.filter((log) => log.status === 'SUBMITTED').length;
  const recentLog = [...logs].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )[0];
  const progressStyle = {
    '--progress-position': isProgressStarted ? `${progressRate}%` : '0%',
  } as CSSProperties;

  return (
    <main className="my-page">
      <section className="my-hero">
        <p className="my-label">My Status</p>
        <h1>나의 현황</h1>
        <p>승인된 독서일지를 기준으로 코스 달성 현황을 확인할 수 있습니다.</p>
      </section>

      <section className="my-course-board">
        <div className="my-course-info">
          <span>현재 코스</span>
          <h2>{participation.courseName}</h2>
          <p>{formatDistance(participation.targetDistanceMeter)} 완주를 목표로 독서기록을 누적하고 있습니다.</p>
        </div>
        <div className="my-progress-area" style={progressStyle}>
          <div className="my-progress-summary">
            <div>
              <span>현재 누적 거리</span>
              <strong>{formatDistance(participation.totalDistanceMeter)} / {formatDistance(participation.targetDistanceMeter)}</strong>
            </div>
            <b>{progressRate}%</b>
          </div>
          <div className="marathon-track" aria-label={`완주율 ${progressRate}%`}>
            <div className="marathon-track-labels"><span>0km</span><span>{formatDistance(participation.targetDistanceMeter)}</span></div>
            <div className="marathon-track-line">
              <div className="marathon-track-fill" />
              <div className="marathon-runner-marker" aria-hidden="true"><span className="runner-percent">{progressRate}%</span><span className="runner-icon">●</span></div>
              <div className="marathon-finish-marker" aria-hidden="true">⚑</div>
            </div>
          </div>
          <p className="my-progress-caption">남은 거리 <strong>{formatDistance(remainingDistance)}</strong></p>
        </div>
      </section>

      <section className="my-stat-grid" aria-label="나의 독서마라톤 요약">
        <article><span>누적 페이지</span><strong>{participation.totalPages.toLocaleString()}쪽</strong><p>승인된 독서일지 기준</p></article>
        <article><span>누적 거리</span><strong>{formatDistance(participation.totalDistanceMeter)}</strong><p>1쪽 = 5m 기준</p></article>
        <article><span>인정 기록</span><strong>{approvedCount}건</strong><p>관리자 확인 완료</p></article>
        <article><span>검토중</span><strong>{pendingCount}건</strong><p>승인 대기 중인 기록</p></article>
      </section>

      <section className="my-latest-section">
        <div className="my-section-head"><div><p className="my-section-kicker">Recent Log</p><h2>최근 제출한 독서일지</h2></div><Link to="/logs" className="my-outline-link">전체 기록 보기</Link></div>
        {recentLog ? (
          <article className="my-latest-card">
            <div><span className={`my-status-badge status-${STATUS_LABEL[recentLog.status]}`}>{STATUS_LABEL[recentLog.status]}</span><h3>{recentLog.books.map((book) => book.bookTitle).join(', ')}</h3><p>{recentLog.books.length}권의 독서 기록</p></div>
            <dl><div><dt>독서 날짜</dt><dd>{recentLog.readingDate}</dd></div><div><dt>읽은 페이지</dt><dd>{recentLog.totalReadPages.toLocaleString()}쪽</dd></div><div><dt>환산 거리</dt><dd>{formatDistance(recentLog.convertedDistanceMeter)}</dd></div></dl>
          </article>
        ) : <article className="my-latest-card"><p>아직 제출한 독서일지가 없습니다.</p></article>}
      </section>
      {readingBooks.length > 0 && <section className="my-latest-section"><div className="my-section-head"><div><p className="my-section-kicker">Reading Books</p><h2>읽는 중인 책</h2></div></div>{readingBooks.map((book) => <article className="my-latest-card" key={book.participantBookId}><div><h3>{book.bookTitle}</h3><p>{book.author || '저자 미상'} · {book.publisher || '출판사 미상'}</p></div><dl><div><dt>승인된 페이지</dt><dd>{book.approvedReadPages.toLocaleString()}쪽</dd></div><div><dt>남은 페이지</dt><dd>{book.remainingPages.toLocaleString()}쪽</dd></div></dl></article>)}</section>}
    </main>
  );
}

export default MyPage;
