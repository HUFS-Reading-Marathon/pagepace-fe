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
      <table className="race-table">
        <caption className="sr-only">
          인정 거리 순 랭킹. 진행률은 참가 코스 목표 거리 기준입니다.
        </caption>
        <thead>
          <tr>
            <th scope="col">순위</th>
            <th scope="col">참가자</th>
            {showIdentity && <th scope="col">학번</th>}
            <th scope="col">코스</th>
            <th scope="col">완주까지</th>
            <th scope="col">승인 쪽수</th>
            <th scope="col">인정 거리</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((row) => (
            <tr
              key={row.participationId}
              className={
                row.participationId === myParticipationId ? "race-row-mine" : ""
              }
            >
              <td>{row.rank}</td>
              <th scope="row">
                {row.name}{" "}
                {row.participationId === myParticipationId && (
                  <span className="race-my-badge">나</span>
                )}
              </th>
              {showIdentity && <td>{row.studentNo}</td>}
              <td>{row.courseName}</td>
              <td>
                <RaceProgress percent={row.progressPercent} />
              </td>
              <td>{row.approvedPages.toLocaleString()}쪽</td>
              <td>
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
