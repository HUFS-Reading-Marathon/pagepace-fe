import type { Ranking } from '../../api/rankingApi';
import { METERS_PER_PAGE } from '../../constants/reading';
import { getRewardTypeLabel } from '../../utils/adminEventForms';
import { hasFinalResults } from '../../utils/eventSelection';
import { formatDistance, getCreditedPages, getProgressPercent } from '../../utils/reading';
import '../../styles/ranking.css';

function RankingAvatar({ name }: { name: string }) {
  return (
    <span className="ranking-avatar" aria-hidden="true">
      {name.trim().slice(0, 1) || '?'}
    </span>
  );
}

function RankingBoard({
  rankings,
  eventStatus,
  showIdentity = false,
  simpleLayout = false,
  myParticipationId,
}: {
  rankings: Ranking[];
  eventStatus?: string;
  showIdentity?: boolean;
  simpleLayout?: boolean;
  myParticipationId?: number;
}) {
  if (rankings.length === 0)
    return (
      <div className="ranking-empty">
        아직 집계된 순위가 없습니다.
        <span>독서일지 승인과 서평 확인을 거친 거리가 순위에 반영됩니다.</span>
      </div>
    );
  const useSimpleLayout = showIdentity || simpleLayout;

  return (
    <section
      className={simpleLayout ? 'ranking-race is-simple' : 'ranking-race'}
      aria-label="전체 참가자 독서 레이스"
    >
      <header>
        <div>
          <h2>{showIdentity ? '참가자별 순위' : '전체 독서 레이스'}</h2>
        </div>
        <p>
          <i /> 인정 거리 <i /> 거리 인정 쪽수
        </p>
      </header>
      <div className="ranking-race-list">
        {rankings.map((ranking, index) => {
          const rate = getProgressPercent(ranking.distance, ranking.targetDistance);
          const progress = Math.min(rate, 100);
          const completed =
            ranking.targetDistance > 0 && ranking.distance >= ranking.targetDistance;
          const remainingPages = Math.ceil(
            (ranking.targetDistance - ranking.distance) / METERS_PER_PAGE,
          );
          const creditedPages = getCreditedPages(ranking.distance).toLocaleString();
          const winner = hasFinalResults(eventStatus) && ranking.awardStatus === 'WINNER';
          const runnerPosition = Math.max(2, Math.min(progress, 96));
          return (
            <article
              key={ranking.participationId}
              className={`${ranking.participationId === myParticipationId ? 'race-row-mine' : ''} ${completed ? 'is-completed' : ''} ${ranking.rank <= 3 ? `is-top-rank is-rank-${ranking.rank}` : ''}`}
            >
              <div
                className={`ranking-race-person ${useSimpleLayout ? 'ranking-race-person--simple' : ''}`}
              >
                {showIdentity && (
                  <span className="ranking-row-number">
                    <small>순번</small>
                    {index + 1}
                  </span>
                )}
                <strong className="ranking-race-rank" aria-label={`순위 ${ranking.rank}위`}>
                  {ranking.rank <= 3 && <span aria-hidden="true">★</span>}
                  {ranking.rank}
                </strong>
                {!useSimpleLayout && <RankingAvatar name={ranking.name} />}
                <span>
                  <b>{ranking.name}</b>
                  {showIdentity && <small>{ranking.studentNo}</small>}
                  {winner && (
                    <small>
                      {ranking.awardCourseName || ranking.courseName} 수상
                      {ranking.awardRewardType && ranking.awardRewardType !== 'NONE' && (
                        <> · {getRewardTypeLabel(ranking.awardRewardType)}</>
                      )}
                      {!!ranking.awardRewardAmount && (
                        <> {ranking.awardRewardAmount.toLocaleString('ko-KR')}원</>
                      )}
                    </small>
                  )}
                  {ranking.participationId === myParticipationId && (
                    <span className="race-my-badge">나</span>
                  )}
                </span>
                {completed && (
                  <em>
                    <span aria-hidden="true">✓</span> 완주
                  </em>
                )}
              </div>
              {useSimpleLayout ? (
                <div className="ranking-race-tracks ranking-race-tracks--simple">
                  <div
                    className="ranking-race-progress-track"
                    role="progressbar"
                    aria-label={`${ranking.name} 누적 거리 진행률`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                  >
                    <span
                      className="ranking-race-progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                    <span
                      className="ranking-race-progress-marker"
                      style={{ left: `${runnerPosition}%` }}
                      aria-hidden="true"
                    />
                    <i className="ranking-race-progress-finish" aria-hidden="true" />
                  </div>
                  <div className="ranking-race-progress-meta">
                    <span>
                      {formatDistance(ranking.distance)} · 일지 승인{' '}
                      {ranking.approvedPages.toLocaleString()}쪽
                    </span>
                    <small>
                      <i aria-hidden="true" /> 거리 인정 {creditedPages}쪽
                    </small>
                  </div>
                </div>
              ) : (
                <div className="ranking-race-tracks">
                  <div className="ranking-race-track is-distance">
                    <span className="ranking-start-mark" aria-hidden="true">
                      START
                    </span>
                    <span className="ranking-race-fill" style={{ width: `${progress}%` }} />
                    <span
                      className="ranking-runner"
                      style={{ left: `${runnerPosition}%` }}
                      aria-hidden="true"
                    >
                      <svg viewBox="0 0 24 24">
                        <circle cx="15" cy="4" r="2" />
                        <path d="m13 7-3 5 4 2 2 6M11 10l-4-2-3 3M10 12l-3 7M14 9l5 3" />
                      </svg>
                    </span>
                    <i className="ranking-finish-mark" aria-hidden="true">
                      FINISH
                    </i>
                    <b>{formatDistance(ranking.distance)}</b>
                  </div>
                  <div className="ranking-race-track is-pages">
                    <span className="ranking-race-fill" style={{ width: `${progress}%` }} />
                    <b>
                      일지 승인 {ranking.approvedPages.toLocaleString()}쪽 · 거리 인정{' '}
                      {creditedPages}쪽
                    </b>
                  </div>
                </div>
              )}
              <div className="ranking-race-percent">
                <strong>{rate.toFixed(1)}%</strong>
                <span>
                  {completed
                    ? '완주'
                    : remainingPages > 0
                      ? `진행 중 · ${remainingPages.toLocaleString()}쪽 남음`
                      : '진행 중'}
                </span>
              </div>
              {showIdentity && completed && <span className="ranking-complete-badge">완주자</span>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default RankingBoard;
