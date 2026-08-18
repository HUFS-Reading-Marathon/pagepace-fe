import type { Ranking } from '../../api/rankingApi';
import '../../styles/ranking.css';

function distanceLabel(distance: number) {
  return distance >= 1000 ? `${(distance / 1000).toFixed(2)}km` : `${distance.toLocaleString()}m`;
}

function RankingAvatar({ name }: { name: string }) {
  return <span className="ranking-avatar" aria-hidden="true">{name.trim().slice(0, 1) || '?'}</span>;
}

function RankingBoard({ rankings, showIdentity = false }: { rankings: Ranking[]; showIdentity?: boolean }) {
  if (rankings.length === 0) return <div className="ranking-empty">아직 집계된 순위가 없습니다.<span>독서일지가 승인되면 순위가 표시됩니다.</span></div>;

  return (
    <>
      <section className="ranking-race" aria-label="전체 참가자 독서 레이스">
        <header><div><span>LIVE MARATHON</span><h2>전체 독서 레이스</h2><small>책장을 넘길 때마다 결승선에 가까워집니다.</small></div><p><i /> 누적 거리 <i /> 승인 페이지</p></header>
        <div className="ranking-race-list">{rankings.map((ranking) => {
          const progress = Math.min(ranking.progressPercent, 100);
          const completed = ranking.progressPercent >= 100;
          const runnerPosition = Math.max(2, Math.min(progress, 96));
          return <article key={`${ranking.rank}-${ranking.studentNo}`} className={`${completed ? 'is-completed' : ''} ${ranking.rank <= 3 ? `is-top-rank is-rank-${ranking.rank}` : ''}`}>
            <div className="ranking-race-person"><strong className="ranking-race-rank">{ranking.rank <= 3 && <span aria-hidden="true">★</span>}{ranking.rank}</strong><RankingAvatar name={ranking.name} /><span><b>{ranking.name}</b><small>{ranking.studentNo}</small></span>{completed && <em><span aria-hidden="true">✓</span> 완주</em>}</div>
            <div className="ranking-race-tracks">
              <div className="ranking-race-track is-distance"><span className="ranking-start-mark" aria-hidden="true">START</span><span className="ranking-race-fill" style={{ width: `${progress}%` }} /><span className="ranking-runner" style={{ left: `${runnerPosition}%` }} aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="15" cy="4" r="2"/><path d="m13 7-3 5 4 2 2 6M11 10l-4-2-3 3M10 12l-3 7M14 9l5 3"/></svg></span><i className="ranking-finish-mark" aria-hidden="true">FINISH</i><b>{distanceLabel(ranking.distance)}</b></div>
              <div className="ranking-race-track is-pages"><span className="ranking-race-fill" style={{ width: `${progress}%` }} /><b>{ranking.approvedPages.toLocaleString()}쪽</b></div>
            </div>
            <div className="ranking-race-percent"><strong>{ranking.progressPercent.toFixed(1)}%</strong><span>{completed ? '목표 달성' : '완주까지 진행 중'}</span></div>
            {showIdentity && completed && <span className="ranking-complete-badge">완주자</span>}
          </article>;
        })}</div>
      </section>
    </>
  );
}

export default RankingBoard;
