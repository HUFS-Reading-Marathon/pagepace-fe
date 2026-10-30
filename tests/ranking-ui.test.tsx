import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RankingBoard from "../src/components/ranking/RankingBoard";
import type { Ranking } from "../src/api/rankingApi";
const row: Ranking = {
  rank: 1,
  participationId: 41,
  courseId: 2,
  courseName: "하프",
  targetDistance: 1000,
  status: "APPROVED",
  name: "김*서",
  studentNo: "20260001",
  approvedPages: 120,
  distance: 500,
  progressPercent: 50,
};
describe("랭킹의 공개 범위와 두 승인 단계", () => {
  it("공개 랭킹은 학번·서평 대기량을 노출하지 않고 쪽수와 인정 거리를 분리한다", () => {
    const html = renderToStaticMarkup(<RankingBoard rankings={[row]} />);
    expect(html).not.toContain(row.studentNo);
    expect(html).not.toContain("서평 대기");
    expect(html).toContain("120쪽");
    expect(html).toContain("500");
    expect(html).toContain("width:50%");
  });
  it("관리자 랭킹은 학번을 제공한다", () => {
    expect(
      renderToStaticMarkup(<RankingBoard rankings={[row]} showIdentity />),
    ).toContain(row.studentNo);
  });
  it("마스킹 이름이 같아도 참가 ID가 일치하는 행만 본인으로 표시한다", () => {
    const html = renderToStaticMarkup(
      <RankingBoard
        rankings={[row, { ...row, rank: 2, participationId: 42 }]}
        myParticipationId={42}
      />,
    );
    expect(html.match(/race-row-mine/g)).toHaveLength(1);
    expect(html.match(/race-my-badge/g)).toHaveLength(1);
  });
  it("목표 초과는 트랙에서 100%로 제한하지만 원래 인정 거리는 유지한다", () => {
    expect(renderToStaticMarkup(<RankingBoard rankings={[{...row, progressPercent:150}]} simpleLayout />)).toContain(
      'aria-valuenow="100"',
    );
    expect(
      renderToStaticMarkup(
        <RankingBoard
          rankings={[{ ...row, distance: 1500, progressPercent: 150 }]}
        />,
      ),
    ).toContain("1.50km");
  });
});
