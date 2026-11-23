import { ApiError, apiRequest } from './apiClient';

export const REQUEST_REASON_LABELS = {
  NOT_HELD: '소장 자료 검색 결과 없음',
  UNKNOWN_PAGES: '서지에 종이책 쪽수가 없음',
  EBOOK: '전자책과 실물 판본 확인',
} as const;
export const REQUEST_STATUS_LABELS = {
  PENDING: '도서 확인 대기',
  LINKED: '일지 심사로 이관',
  REJECTED: '반려',
} as const;

export type NewBookRequest = {
  participationId: number;
  readingDate: string;
  readPages: number;
  reason: keyof typeof REQUEST_REASON_LABELS;
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  note: string;
};
export type BookRequest = NewBookRequest & {
  id: number;
  eventId: number;
  status: keyof typeof REQUEST_STATUS_LABELS;
  createdAt: string;
  reviewedAt: string | null;
  rejectReason: string | null;
  readingLogId: number | null;
  studentNo: string;
  participantName: string;
};
export type ConfirmedCatalogBook = {
  libraryBookId: number;
  bookTitle: string;
  totalBookPages: number;
  author: string | null;
  publisher: string | null;
  isbn: string | null;
  callNo: string | null;
  coverImageUrl: string | null;
};
export async function getBookRequests(eventId: number, admin = false) {
  return (
    (await apiRequest<BookRequest[]>(
      `/api/${admin ? 'admin' : 'me'}/book-requests?eventId=${eventId}`,
    )) ?? []
  );
}
async function changeRequest(path: string, method: 'POST' | 'PATCH', body: object) {
  const result = await apiRequest<BookRequest>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!result?.id) throw new ApiError('도서 확인 요청의 처리 결과를 확인하지 못했습니다.');
  return result;
}
export function sendBookRequest(body: NewBookRequest) {
  return changeRequest('/api/me/book-requests', 'POST', body);
}
export function approveBookRequest(id: number, body: ConfirmedCatalogBook) {
  return changeRequest(`/api/admin/book-requests/${id}/approve`, 'PATCH', body);
}
export function rejectBookRequest(id: number, reason: string) {
  return changeRequest(`/api/admin/book-requests/${id}/reject`, 'PATCH', { reason });
}
