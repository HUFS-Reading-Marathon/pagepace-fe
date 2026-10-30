import type { Ranking } from "../../api/rankingApi";
import "../../styles/ranking.css";

export function RaceProgress({ percent }: { percent: number }) {
  const value = Math.max(
    0,
    Math.min(Number.isFinite(percent) ? percent : 0, 100),
  );
  return (
    <div className="race-progress">
      <div
        role="progressbar"
        aria-label="인정 거리 기준 목표 달성률"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <span style={{ width: `${value}%` }} />
      </div>
      <span aria-hidden="true">⚑</span>
      <small>{value.toFixed(1)}%</small>
    </div>
  );
}
export default function RankingBoard({
  rankings,
  showIdentity = false,
  myParticipationId,
}: {
  rankings: Ranking[];
  showIdentity?: boolean;
  simpleLayout?: boolean;
  myParticipationId?: number;
}) {
  if (!rankings.length)
    return <p className="ranking-empty">아직 승인된 독서 기록이 없습니다.</p>;
  return (
    <div className="table-scroll race-table-wrap">
      <table className="race-table" role="table">
        <caption className="sr-only">
          인정 거리 순 랭킹. 진행률은 참가 코스 목표 거리 기준입니다.
        </caption>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">순위</th>
            <th scope="col" role="columnheader">참가자</th>
            {showIdentity && <th scope="col" role="columnheader">학번</th>}
            <th scope="col" role="columnheader">코스</th>
            <th scope="col" role="columnheader">완주까지</th>
            <th scope="col" role="columnheader">승인 쪽수</th>
            <th scope="col" role="columnheader">인정 거리</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rankings.map((row) => (
            <tr
              role="row"
              key={row.participationId}
              className={
                row.participationId === myParticipationId ? "race-row-mine" : ""
              }
            >
              <td role="cell" className="race-position"><span>{row.rank}</span><span className="race-mobile-unit">위</span></td>
              <th scope="row" role="rowheader" className="race-person">
                {row.name}{" "}
                {row.participationId === myParticipationId && (
                  <span className="race-my-badge">나</span>
                )}
              </th>
              {showIdentity && <td role="cell" data-label="학번">{row.studentNo}</td>}
              <td role="cell" data-label="코스">{row.courseName}</td>
              <td role="cell" className="race-track" data-label="완주까지">
                <RaceProgress percent={row.progressPercent} />
              </td>
              <td role="cell" data-label="승인 쪽수">{row.approvedPages.toLocaleString()}쪽</td>
              <td role="cell" data-label="인정 거리">
                <strong>{row.distance.toLocaleString()}m</strong>
                {row.status === "COMPLETED" && (
                  <small className="race-complete">완주</small>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
