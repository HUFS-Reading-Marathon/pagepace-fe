import { ApiError, apiRequest } from './apiClient';

export type Ranking = {
  rank: number;
  name: string;
  studentNo: string;
  approvedPages: number;
  distance: number;
  progressPercent: number;
};

export type RankingSort = 'RANK' | 'NAME';

function createRankingParams(eventId: number, courseId?: number, sort: RankingSort = 'RANK') {
  if (!Number.isInteger(eventId) || eventId <= 0) {
    throw new ApiError('행사 ID가 올바르지 않습니다.', 0, 'INVALID_EVENT_ID');
  }

  const searchParams = new URLSearchParams({ eventId: String(eventId) });
  if (courseId) searchParams.set('courseId', String(courseId));
  searchParams.set('sort', sort);
  return searchParams;
}

export async function getRankings(eventId: number, courseId?: number, sort: RankingSort = 'RANK') {
  const searchParams = createRankingParams(eventId, courseId, sort);

  const rankings = await apiRequest<Ranking[]>(
    `/api/rankings?${searchParams.toString()}`,
    { method: 'GET' },
  );
  return rankings ?? [];
}

export async function getAdminRankings(eventId: number, courseId?: number, sort: RankingSort = 'RANK') {
  const searchParams = createRankingParams(eventId, courseId, sort);
  const rankings = await apiRequest<Ranking[]>(
    `/api/admin/rankings?${searchParams.toString()}`,
    { method: 'GET' },
  );
  return rankings ?? [];
}
