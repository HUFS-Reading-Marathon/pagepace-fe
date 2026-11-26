import { useEffect, useState } from 'react';
import type { AdminCompetitionCourseSummary } from '../../../types/adminStatus';
import { getEmptyPhase } from './dashboardEmptyCopy';

type DashboardCourseCompletionProps = {
  summaries: AdminCompetitionCourseSummary[];
  isSupported?: boolean;
  /**
   * 값이 바뀔 때만 채우기 애니메이션을 다시 실행합니다(예: 데이터를 새로 받은 시각).
   * 일반 리렌더링이나 다른 카드의 필터 변경으로는 다시 실행되지 않습니다.
   */
  animationKey?: number;
  /** 실제 행사 상태(참가자가 없을 때 '행사 시작 전'과 '참가자 없음'을 구분합니다) */
  eventStatus?: string | null;
};

const ANIMATION_MS = 1100;
const DONUT_RADIUS = 52;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

/** 완주율(%): 참가자가 없으면 null, 그 밖에는 0~100 */
function completionRate(completed: number, participants: number) {
  if (!Number.isFinite(completed) || !Number.isFinite(participants) || participants <= 0) {
    return null;
  }

  return Math.min(100, Math.max(0, (completed / participants) * 100));
}

/** 소수 첫째 자리까지, 불필요한 0은 생략(33.3, 50, 0) */
function formatRate(value: number) {
  return String(Math.round(value * 10) / 10);
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * 0→1로 차오르는 진행도. key가 바뀔 때만 다시 시작하고, 동작 줄이기 설정이면 바로 1입니다.
 * 도넛·프로그레스바·가운데 숫자가 같은 값을 쓰므로 함께 움직입니다.
 */
function useFillProgress(key: number | undefined) {
  // 어느 key의 진행도인지 함께 저장해, key가 바뀌면 곧바로 0에서 다시 시작하게 합니다.
  const [state, setState] = useState<{ key: number | undefined; value: number }>({
    key,
    value: 0,
  });

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const frame = requestAnimationFrame(() => setState({ key, value: 1 }));
      return () => cancelAnimationFrame(frame);
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ANIMATION_MS);
      setState({ key, value: easeOut(t) });
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [key]);

  return state.key === key ? state.value : 0;
}

function DashboardCourseCompletion({
  summaries,
  isSupported = true,
  animationKey,
  eventStatus,
}: DashboardCourseCompletionProps) {
  const progress = useFillProgress(animationKey);
  const totalParticipants = summaries.reduce((sum, summary) => sum + summary.participantCount, 0);
  const totalCompleted = summaries.reduce((sum, summary) => sum + summary.completedCount, 0);
  const totalRate = completionRate(totalCompleted, totalParticipants);
  const shownRate = (totalRate ?? 0) * progress;
  // 가는 호 끝이 점으로 보이지 않도록 아주 짧은 값은 그리지 않습니다.
  const arcLength = (DONUT_CIRCUMFERENCE * shownRate) / 100;

  return (
    <section className="admin-dashboard__card admin-dashboard__course-progress admin-dashboard__enter">
      <header className="admin-dashboard__card-header">
        <h2>완주 현황</h2>
        <strong>
          {isSupported ? `${totalCompleted} / ${totalParticipants}명` : '집계 미지원'}
        </strong>
      </header>

      {!isSupported ? (
        <div className="admin-dashboard__empty">
          현재 백엔드 응답에 참가자별 완주 집계가 포함되어 있지 않습니다.
        </div>
      ) : (
        <>
          <div
            className="admin-dashboard__donut"
            role="img"
            aria-label={
              totalRate === null
                ? '전체 완주율: 참가자 없음'
                : `전체 완주율 ${formatRate(totalRate)}% (${totalCompleted} / ${totalParticipants}명)`
            }
          >
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle className="admin-dashboard__donut-track" cx="60" cy="60" r={DONUT_RADIUS} />
              {arcLength >= 0.5 && (
                <circle
                  className="admin-dashboard__donut-value"
                  cx="60"
                  cy="60"
                  r={DONUT_RADIUS}
                  strokeDasharray={`${arcLength} ${DONUT_CIRCUMFERENCE}`}
                />
              )}
            </svg>
            <div className="admin-dashboard__donut-center" aria-hidden="true">
              {totalRate === null ? (
                <>
                  <strong>—</strong>
                  <span>
                    {getEmptyPhase(eventStatus) === 'before' ? '행사 시작 전' : '참가자 없음'}
                  </span>
                </>
              ) : (
                <>
                  <strong>{formatRate(shownRate)}%</strong>
                  <span>전체 완주율</span>
                </>
              )}
            </div>
          </div>

          {summaries.length === 0 && (
            <p className="admin-dashboard__course-none-note">등록된 코스가 없습니다.</p>
          )}
          <ul className="admin-dashboard__course-rates">
            {summaries.map((summary) => {
              const rate = completionRate(summary.completedCount, summary.participantCount);

              return (
                <li key={summary.courseId}>
                  <div>
                    <span>{summary.courseName}</span>
                    {rate === null ? (
                      <strong className="admin-dashboard__course-none">참가자 없음</strong>
                    ) : (
                      <strong>
                        {summary.completedCount} / {summary.participantCount}명
                      </strong>
                    )}
                  </div>
                  <div
                    className="admin-dashboard__course-bar"
                    role="progressbar"
                    aria-label={`${summary.courseName} 완주율`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={rate === null ? undefined : Math.round(rate * 10) / 10}
                    aria-valuetext={rate === null ? '참가자 없음' : `${formatRate(rate)}%`}
                  >
                    <span style={{ width: `${(rate ?? 0) * progress}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

export default DashboardCourseCompletion;
