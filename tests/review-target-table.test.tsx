import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AdminReviewTarget } from '../src/api/adminReadingLogApi';
import ReviewTargetTable from '../src/components/admin/reviews/ReviewTargetTable';
import DetailNavBar from '../src/components/admin/table/DetailNavBar';
import { nextCandidateId } from '../src/components/admin/table/queueNavigation';
import {
  INITIAL_REVIEW_SEARCH,
  readReviewListState,
  reviewFilterCounts,
  visibleReviewTargets,
  writeReviewListState,
  type ReviewSearch,
} from '../src/components/admin/reviews/reviewTargetFilters';

const target: AdminReviewTarget = {
  participantBookId: 1,
  participationId: 1,
  userId: 1,
  userName: '김서평',
  studentNo: '20260001',
  bookTitle: '코스모스',
  author: '칼 세이건',
  approvedReadPages: 120,
  distanceToCreditMeter: 600,
  reviewSearchUrl: null,
  reviewSubmittedAt: '2026-11-20T10:00:00',
  reviewVerified: false,
  reviewVerifiedAt: null,
};
const verified = {
  ...target,
  participantBookId: 2,
  userName: '이완료',
  bookTitle: '사피엔스',
  author: '유발 하라리',
  // 솔라스 대조로 확인된 건은 참가자 제출 시각 없이 확인 시각만 있을 수 있습니다.
  reviewSubmittedAt: null,
  reviewVerified: true,
  reviewVerifiedAt: '2026-11-21T09:00:00',
  distanceToCreditMeter: 0,
};
const noDate = {
  ...target,
  participantBookId: 3,
  userName: '박알림',
  reviewSubmittedAt: null,
};

describe('서평 개별 확인 목록 필터', () => {
  it('처음에는 확인 대기만 보여 주고, 확인 완료와 전체는 상태 필터로 본다', () => {
    const ids = (patch: Partial<ReviewSearch>) =>
      visibleReviewTargets([target, verified, noDate], { ...INITIAL_REVIEW_SEARCH, ...patch }).map(
        (row) => row.participantBookId,
      );
    expect(ids({})).toEqual([1, 3]);
    expect(ids({ filter: 'verified' })).toEqual([2]);
    expect(ids({ filter: 'all' })).toEqual([1, 2, 3]);
    expect(reviewFilterCounts([target, verified, noDate])).toEqual({
      pending: 2,
      verified: 1,
      all: 3,
    });
  });

  it('이름·학번·도서명·저자로 찾고, 시각을 모르는 대상은 정렬 방향과 관계없이 마지막에 둔다', () => {
    const all = [noDate, verified, target];
    const ids = (patch: Partial<ReviewSearch>) =>
      visibleReviewTargets(all, { ...INITIAL_REVIEW_SEARCH, filter: 'all', ...patch }).map(
        (row) => row.participantBookId,
      );
    expect(ids({ query: '세이건' })).toEqual([1, 3]);
    expect(ids({ query: '사피' })).toEqual([2]);
    expect(ids({ sort: 'newest' })).toEqual([2, 1, 3]);
  });
});

describe('서평 개별 확인 표', () => {
  const render = (props: Partial<React.ComponentProps<typeof ReviewTargetTable>> = {}) =>
    renderToStaticMarkup(
      <ReviewTargetTable
        rows={[target, noDate]}
        total={2}
        page={0}
        pageSize={20}
        search={INITIAL_REVIEW_SEARCH}
        counts={{ pending: 2, verified: 1, all: 3 }}
        loading={false}
        busy={false}
        error=""
        hasLoaded
        onSearch={vi.fn()}
        onReset={vi.fn()}
        onRefresh={vi.fn()}
        onPage={vi.fn()}
        onPageSize={vi.fn()}
        onOpen={vi.fn()}
        {...props}
      />,
    );

  it('전체 너비 표에 승인 독서량·서평 시각·상태·미인정 거리와 확인 버튼을 둔다', () => {
    const html = render();
    const headings = Array.from(
      html.match(/<thead>(.*?)<\/thead>/s)![1].matchAll(/<th\b[^>]*>(.*?)<\/th>/gs),
      (match) => match[1],
    );
    expect(headings).toEqual([
      '순번',
      '이름',
      '학번·사번',
      '도서명',
      '저자',
      '승인 독서량',
      '서평 시각',
      '상태',
      '미인정 거리',
      '확인',
    ]);
    expect(html).toContain('120쪽');
    expect(html).toContain('600m');
    expect(html).toContain('2026-11-20 10:00');
    expect(html).toContain('알림 없음');
    expect(html).toContain('aria-label="1번 김서평 코스모스 서평 확인하기"');
    expect(html).toContain('확인 대기 (2)');
    expect(html).not.toContain('admin-split');
  });

  it('확인 완료 대상은 상세 보기로 열고 상태를 구분한다', () => {
    const html = render({
      rows: [verified],
      search: { ...INITIAL_REVIEW_SEARCH, filter: 'verified' },
    });
    expect(html).toContain('>상세 보기</button>');
    expect(html).toContain('data-verified="true">확인 완료');
    expect(html).toContain('<small>확인 </small>2026-11-21 09:00');
  });

  it('불러오는 중·대기 없음·검색 결과 없음·조회 실패를 서로 다른 문구로 보여 준다', () => {
    expect(render({ rows: [], total: 0, loading: true })).toContain(
      '확인 대상을 불러오고 있습니다.',
    );
    expect(render({ rows: [], total: 0 })).toContain('확인 대기 중인 서평이 없습니다.');
    expect(
      render({ rows: [], total: 0, search: { ...INITIAL_REVIEW_SEARCH, query: '없는 이름' } }),
    ).toContain('조건에 맞는 서평이 없습니다.');
    const failed = render({ rows: [], total: 0, error: '서버 오류', hasLoaded: false });
    expect(failed).toContain('서평 확인 대상을 불러오지 못했습니다.');
    expect(failed).not.toContain('확인 대기 중인 서평이 없습니다.');
  });

  it('다시 조회가 실패해도 마지막으로 받은 목록을 그대로 두고 오류와 다시 조회 버튼을 보여 준다', () => {
    const html = render({ error: '서평 확인 대상을 다시 불러오지 못했습니다.' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('아래는 마지막으로 불러온 목록입니다.');
    expect(html).toContain('김서평');
    expect(html).toContain('>다시 조회</button>');
  });
});

describe('서평 상세 확인 이동', () => {
  it('목록 조건을 URL에 담고 기본값은 생략하며 행사·탭 파라미터는 그대로 둔다', () => {
    const base = new URLSearchParams('eventId=6&tab=manual');
    const state = {
      search: { filter: 'all' as const, query: '코스모스', sort: 'newest' as const },
      page: 2,
      pageSize: 50,
    };
    const written = writeReviewListState(base, state);
    expect(written.get('eventId')).toBe('6');
    expect(written.get('tab')).toBe('manual');
    expect(readReviewListState(written)).toEqual(state);
    expect(
      writeReviewListState(base, {
        search: INITIAL_REVIEW_SEARCH,
        page: 0,
        pageSize: 20,
      }).toString(),
    ).toBe('eventId=6&tab=manual');
    expect(readReviewListState(new URLSearchParams('rf=done&rsize=7&rpage=0'))).toEqual({
      search: INITIAL_REVIEW_SEARCH,
      page: 0,
      pageSize: 20,
    });
  });

  it('확인 후에는 같은 조건의 다음 대기 대상으로, 없으면 가까운 앞쪽 대상으로 이어 간다', () => {
    expect(nextCandidateId([1, 2, 3, 4], 2, [1, 3, 4])).toBe(3);
    expect(nextCandidateId([1, 2, 3, 4], 4, [1, 2, 3])).toBe(3);
    expect(nextCandidateId([1, 2, 3, 4], 2, [1, 4])).toBe(4);
    expect(nextCandidateId([1, 2], 2, [])).toBeNull();
    // 확인한 대상이 재조회 결과에 아직 남아 있어도 다시 고르지 않는다
    expect(nextCandidateId([1, 2], 1, [1, 2])).toBe(2);
  });

  it('상세 이동 막대는 목록으로·위치·이전·다음을 보여 주고 이동할 곳이 없으면 버튼을 끈다', () => {
    const html = renderToStaticMarkup(
      <DetailNavBar
        noun="서평"
        position={{ index: 0, total: 30 }}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    expect(html).toContain('aria-label="서평 이동"');
    expect(html).toContain('목록으로');
    expect(html).toContain('1 / 30');
    expect(html).toMatch(/disabled=""[^>]*>이전 서평<\/button>/);
    expect(html).toMatch(/<button[^>]*class="admin-button">다음 서평<\/button>/);
  });
});
