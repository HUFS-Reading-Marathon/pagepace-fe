import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../src/api/apiClient';
import { getEventSummary } from '../src/api/eventApi';
import { getCurrentParticipation } from '../src/api/participationApi';
import { getMyBookProgress, getReviewTargetBooks } from '../src/api/readingLogApi';
import { getRankings, getAdminRankings } from '../src/api/rankingApi';
import { selectEvent } from '../src/utils/eventSelection';

vi.mock('../src/api/apiClient', () => ({ apiRequest: vi.fn(), ApiError: class extends Error {} }));
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  vi.stubGlobal('window', new EventTarget());
  vi.mocked(apiRequest).mockReset().mockResolvedValue([]);
});
describe('develop 병합 후 행사 및 권한별 API 연동', () => {
  it('개인 행사 선택을 참가 조회와 서평 안내에 함께 전달한다', async () => {
    selectEvent('personal', 7);
    await getCurrentParticipation();
    await getReviewTargetBooks();
    await getMyBookProgress();
    expect(vi.mocked(apiRequest).mock.calls.map((call) => call[0])).toEqual([
      '/api/me/participations/current?eventId=7',
      '/api/me/review-target-books?eventId=7',
      '/api/me/book-progress?eventId=7',
    ]);
  });
  it('다른 행사 일지를 수정할 때 명시한 행사가 저장된 선택보다 우선한다', async () => {
    selectEvent('personal', 7);
    await getReviewTargetBooks(2);
    await getMyBookProgress(2);
    expect(vi.mocked(apiRequest).mock.calls.map((call) => call[0])).toEqual([
      '/api/me/review-target-books?eventId=2',
      '/api/me/book-progress?eventId=2',
    ]);
  });
  it('공개 집계는 기록 없는 참가자를 포함하는 서버 값을 그대로 받는다', async () => {
    const summary = {
      eventId: 7,
      courseId: 2,
      participantCount: 12,
      completedCount: 1,
      approvedPages: 100,
      verifiedDistanceMeter: 300,
      maxDistanceMeter: 300,
    };
    vi.mocked(apiRequest).mockResolvedValue(summary);
    expect(await getEventSummary(7, 2)).toEqual(summary);
    expect(apiRequest).toHaveBeenCalledWith('/api/events/7/summary?courseId=2', {
      method: 'GET',
      skipAuth: true,
    });
  });
  it('관리자 집계는 인증 요청을 유지한다', async () => {
    await getEventSummary(7, undefined, true);
    expect(apiRequest).toHaveBeenCalledWith('/api/admin/events/7/summary', {
      method: 'GET',
      skipAuth: false,
    });
  });
  it('공개 순위와 관리자 순위의 인증 경로를 구분한다', async () => {
    await getRankings(7, 2);
    await getAdminRankings(7, 2);
    const calls = vi.mocked(apiRequest).mock.calls;
    expect(calls[0][0]).toContain('/api/rankings?eventId=7');
    expect(calls[0][1]).toMatchObject({ skipAuth: true });
    expect(calls[1][0]).toContain('/api/admin/rankings?eventId=7');
    expect(calls[1][1]).not.toHaveProperty('skipAuth', true);
  });
});
