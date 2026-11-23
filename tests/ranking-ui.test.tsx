import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RankingBoard from '../src/components/ranking/RankingBoard';
import type { Ranking } from '../src/api/rankingApi';
const row: Ranking = {
  rank: 1,
  participationId: 41,
  courseId: 2,
  courseName: '하프',
  targetDistance: 1000,
  status: 'APPROVED',
  name: '김*서',
  studentNo: '20260001',
  approvedPages: 120,
  distance: 500,
  progressPercent: 50,
};
describe('랭킹의 공개 범위와 두 승인 단계', () => {
  it('공개 랭킹은 학번·서평 대기량을 노출하지 않고 쪽수와 인정 거리를 분리한다', () => {
    const html = renderToStaticMarkup(<RankingBoard rankings={[row]} />);
    expect(html).not.toContain(row.studentNo);
    expect(html).not.toContain('서평 대기');
    expect(html).toContain('120쪽');
    expect(html).toContain('500');
    expect(html).toContain('width:50%');
  });
  it.each([true, false])(
    '완주까지 1쪽 남으면 진행률과 인정량을 반올림하지 않는다 (간단 보기 %s)',
    (simpleLayout) => {
      const near = {
        ...row,
        distance: 42190,
        targetDistance: 42195,
        approvedPages: 8488,
        progressPercent: 100,
      };
      const html = renderToStaticMarkup(
        <RankingBoard rankings={[near]} simpleLayout={simpleLayout} />,
      );
      expect(html).toContain('99.9%');
      expect(html).toContain('1쪽 남음');
      expect(html).toContain('일지 승인 8,488쪽');
      expect(html).toContain('거리 인정 8,438쪽');
      const finished = renderToStaticMarkup(
        <RankingBoard rankings={[{ ...near, distance: 42195 }]} simpleLayout={simpleLayout} />,
      );
      expect(finished).toContain('42.195km');
      expect(finished).toContain('100.0%');
      expect(finished).not.toContain('쪽 남음');
    },
  );
  it.each(['IN_PROGRESS', 'ENDED', 'FINALIZED', 'ARCHIVED'])(
    '확정 수상 내역만 보여 준다 (%s)',
    (status) => {
      const winner: Ranking = {
        ...row,
        awardStatus: 'WINNER',
        awardCourseName: '하프',
        awardRewardType: 'GIFT_CARD',
        awardRewardAmount: 50000,
      };
      const render = (award: Ranking) =>
        renderToStaticMarkup(<RankingBoard rankings={[award]} eventStatus={status} />);
      if (status === 'FINALIZED' || status === 'ARCHIVED') {
        expect(render(winner)).toContain('하프 수상 · 문화상품권 50,000원');
      } else {
        expect(render(winner)).not.toContain('수상');
      }
      expect(render({ ...winner, awardStatus: 'CANDIDATE' })).not.toContain('수상');
    },
  );
  it('관리자 랭킹은 학번을 제공한다', () => {
    expect(renderToStaticMarkup(<RankingBoard rankings={[row]} showIdentity />)).toContain(
      row.studentNo,
    );
  });
  it('마스킹 이름이 같아도 참가 ID가 일치하는 행만 본인으로 표시한다', () => {
    const html = renderToStaticMarkup(
      <RankingBoard
        rankings={[row, { ...row, rank: 2, participationId: 42 }]}
        myParticipationId={42}
      />,
    );
    expect(html.match(/race-row-mine/g)).toHaveLength(1);
    expect(html.match(/race-my-badge/g)).toHaveLength(1);
  });
  it('목표 초과는 트랙에서 100%로 제한하지만 원래 인정 거리는 유지한다', () => {
    expect(
      renderToStaticMarkup(
        <RankingBoard rankings={[{ ...row, distance: 1500, progressPercent: 150 }]} simpleLayout />,
      ),
    ).toContain('aria-valuenow="100"');
    expect(
      renderToStaticMarkup(
        <RankingBoard rankings={[{ ...row, distance: 1500, progressPercent: 150 }]} />,
      ),
    ).toContain('1.50km');
  });
});
