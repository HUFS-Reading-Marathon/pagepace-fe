import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { readingLogs, selectedCourse } from '../../mocks/readingLogs';
import { formatDistance, getProgressRate } from '../../utils/reading';
import './my.css';

function MyPage() {
  const [isProgressStarted, setIsProgressStarted] = useState(false);

  const totalPages = readingLogs.reduce((sum, log) => sum + log.pages, 0);
  const totalDistance = totalPages * 5;
  const progressRate = getProgressRate(totalDistance, selectedCourse.targetDistance);
  const remainingDistance = Math.max(selectedCourse.targetDistance - totalDistance, 0);

  const approvedCount = readingLogs.filter((log) => log.status === '인정').length;
  const pendingCount = readingLogs.filter((log) => log.status === '검토중').length;
  const recentLog = readingLogs[readingLogs.length - 1];

  const progressStyle = {
    '--progress-position': isProgressStarted ? `${progressRate}%` : '0%',
  } as CSSProperties;

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setIsProgressStarted(true);
    });

    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <main className="my-page">
      <section className="my-hero">
        <p className="my-label">My Status</p>
        <h1>나의 현황</h1>
        <p>
          선택한 코스의 누적 페이지, 누적 거리, 완주율과 최근 제출 상태를 확인할 수 있습니다.
        </p>
      </section>

      <section className="my-course-board">
        <div className="my-course-info">
          <span>현재 코스</span>
          <h2>{selectedCourse.name}</h2>
          <p>
            {formatDistance(selectedCourse.targetDistance)} 완주를 목표로 독서기록을
            누적하고 있습니다.
          </p>
        </div>

        <div className="my-progress-area" style={progressStyle}>
          <div className="my-progress-summary">
            <div>
              <span>현재 누적 거리</span>
              <strong>
                {formatDistance(totalDistance)} / {formatDistance(selectedCourse.targetDistance)}
              </strong>
            </div>
            <b>{progressRate}%</b>
          </div>

          <div className="marathon-track" aria-label={`완주율 ${progressRate}%`}>
            <div className="marathon-track-labels">
              <span>0km</span>
              <span>{formatDistance(selectedCourse.targetDistance)}</span>
            </div>

            <div className="marathon-track-line">
              <div className="marathon-track-fill" />

              <div className="marathon-runner-marker" aria-hidden="true">
                <span className="runner-percent">{progressRate}%</span>

                {/* 깨지지 않는 깔끔한 라인 아트 러너 아이콘으로 교체 */}
                <svg
                  className="runner-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  role="img"
                  aria-label="러너 아이콘"
                >
                  <circle cx="15" cy="5" r="2" fill="currentColor" stroke="none" />
                  <path d="M15 7L13 14" />
                  <path d="M13 9L9 10L7 8" />
                  <path d="M13 9L16 11L18 8" />
                  <path d="M13 14L15 19L19 20" />
                  <path d="M13 14L10 19L5 18" />
                </svg>
              </div>

              <div className="marathon-finish-marker" aria-hidden="true">
                {/* 선 위에 깃대가 올라오도록 깃발 아이콘 교체 */}
                <svg viewBox="0 0 24 24" className="finish-icon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 24V4" />
                  <path d="M20 4H6l4 5-4 5h14" fill="currentColor" strokeWidth="1" />
                </svg>
              </div>
            </div>
          </div>

          <p className="my-progress-caption">
            남은 거리 <strong>{formatDistance(remainingDistance)}</strong>
          </p>
        </div>
      </section>

      <section className="my-stat-grid" aria-label="나의 독서마라톤 요약">
        <article>
          <span>누적 페이지</span>
          <strong>{totalPages.toLocaleString()}쪽</strong>
          <p>제출된 독서일지 기준</p>
        </article>

        <article>
          <span>누적 거리</span>
          <strong>{formatDistance(totalDistance)}</strong>
          <p>1쪽 = 5m 기준</p>
        </article>

        <article>
          <span>인정 기록</span>
          <strong>{approvedCount}건</strong>
          <p>관리자 확인 완료</p>
        </article>

        <article>
          <span>검토중</span>
          <strong>{pendingCount}건</strong>
          <p>승인 대기 중인 기록</p>
        </article>
      </section>

      <section className="my-latest-section">
        <div className="my-section-head">
          <div>
            <p className="my-section-kicker">Recent Log</p>
            <h2>최근 제출한 독서일지</h2>
          </div>

          <Link to="/logs" className="my-outline-link">
            전체 기록 보기
          </Link>
        </div>

        <article className="my-latest-card">
          <div>
            <span className={`my-status-badge status-${recentLog.status}`}>
              {recentLog.status}
            </span>
            <h3>{recentLog.title}</h3>
            <p>
              {recentLog.author} · {recentLog.publisher}
            </p>
          </div>

          <dl>
            <div>
              <dt>독서 날짜</dt>
              <dd>{recentLog.date}</dd>
            </div>
            <div>
              <dt>읽은 페이지</dt>
              <dd>{recentLog.pages.toLocaleString()}쪽</dd>
            </div>
            <div>
              <dt>환산 거리</dt>
              <dd>{formatDistance(recentLog.pages * 5)}</dd>
            </div>
          </dl>
        </article>
      </section>
    </main>
  );
}

export default MyPage;