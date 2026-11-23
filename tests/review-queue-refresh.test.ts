import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/api/apiClient', () => ({ apiRequest: vi.fn(), ApiError: class extends Error {} }));

import {
  replaceReviewTarget,
  settleReviewTargets,
  type AdminReviewTarget,
} from '../src/api/adminReadingLogApi';

function target(id: number, patch: Partial<AdminReviewTarget> = {}): AdminReviewTarget {
  return {
    participantBookId: id,
    participationId: 1,
    userId: id,
    userName: `참가자${id}`,
    studentNo: `2026000${id}`,
    bookTitle: `책${id}`,
    author: null,
    approvedReadPages: 100,
    distanceToCreditMeter: 500,
    reviewSearchUrl: null,
    reviewSubmittedAt: '2026-11-20T10:00:00',
    reviewVerified: false,
    reviewVerifiedAt: null,
    ...patch,
  };
}

describe('서평 확인 목록 재조회', () => {
  const previous = [target(1), target(2)];

  it('재조회에 성공하면 서버 목록으로 바꾼다', () => {
    const next = [target(2)];
    expect(settleReviewTargets(previous, { status: 'fulfilled', value: next })).toBe(next);
  });

  it('서버가 빈 목록을 주면 빈 목록을 그대로 쓴다', () => {
    expect(settleReviewTargets(previous, { status: 'fulfilled', value: [] })).toEqual([]);
  });

  it('재조회가 실패하면 마지막으로 받은 목록을 비우지 않는다', () => {
    const result = settleReviewTargets(previous, {
      status: 'rejected',
      reason: new Error('503'),
    });
    expect(result).toBe(previous);
  });

  it('확인 처리 결과는 재조회 전에도 해당 항목에만 반영한다', () => {
    const verified = target(2, { reviewVerified: true, distanceToCreditMeter: 0 });
    const next = replaceReviewTarget(previous, verified);
    expect(next[0]).toBe(previous[0]);
    expect(next[1]).toEqual(verified);
    expect(previous[1].reviewVerified).toBe(false);
  });
});
