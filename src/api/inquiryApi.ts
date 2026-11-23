import { ApiError, apiRequest } from './apiClient';

export type BoardView = 'faq' | 'public' | 'mine' | 'pending' | 'all';
export type Inquiry = {
  id: number;
  kind: 'QUESTION' | 'FAQ';
  title: string;
  content: string;
  answer: string | null;
  publicEntry: boolean;
  authorName: string | null;
  createdAt: string;
  answeredAt: string | null;
  version: number;
};
export type InquiryListing = { items: Inquiry[]; total: number; pages: number };
export const INQUIRIES_PER_PAGE = 15;

export async function loadInquiries(view: BoardView, admin: boolean, q: string, page: number) {
  const path = admin
    ? '/api/admin/inquiries'
    : view === 'mine'
      ? '/api/me/inquiries'
      : '/api/inquiries';
  const params = new URLSearchParams({
    kind: view === 'faq' ? 'FAQ' : 'QUESTION',
    q,
    page: String(page),
  });
  if (view === 'pending') params.set('pending', 'true');
  const data = await apiRequest<InquiryListing>(path + '?' + params, {
    skipAuth: !admin && view !== 'mine',
  });
  if (!data) throw new ApiError('문의 목록을 불러오지 못했습니다.');
  return data;
}
// The listing API pages newest-first. An ascending page spans at most two of those pages.
export async function loadInquiryPage(
  view: BoardView,
  admin: boolean,
  q: string,
  page: number,
  oldestFirst: boolean,
) {
  if (!oldestFirst) return loadInquiries(view, admin, q, page);
  const first = await loadInquiries(view, admin, q, 0);
  if (page >= first.pages) return { ...first, items: [] };
  const end = first.total - page * INQUIRIES_PER_PAGE;
  const start = Math.max(0, end - INQUIRIES_PER_PAGE);
  const firstPage = Math.floor(start / INQUIRIES_PER_PAGE);
  const lastPage = Math.floor((end - 1) / INQUIRIES_PER_PAGE);
  const pages = await Promise.all(
    Array.from({ length: lastPage - firstPage + 1 }, (_, index) => {
      const number = firstPage + index;
      return number === 0 ? first : loadInquiries(view, admin, q, number);
    }),
  );
  const offset = start % INQUIRIES_PER_PAGE;
  const items = pages
    .flatMap((result) => result.items)
    .slice(offset, offset + end - start)
    .reverse();
  return { ...first, items };
}

export function postQuestion(title: string, content: string, publicEntry: boolean) {
  return write('/api/me/inquiries', 'POST', { title, content, publicEntry });
}
export function saveAnswer(item: Inquiry, answer: string) {
  return write(`/api/admin/inquiries/${item.id}/answer`, 'PUT', { answer, version: item.version });
}
export function saveFaq(item: Inquiry | null, title: string, answer: string, publicEntry: boolean) {
  const path = '/api/admin/inquiries/faqs';
  return write(item ? `${path}/${item.id}` : path, item ? 'PUT' : 'POST', {
    title,
    answer,
    publicEntry,
    version: item?.version,
  });
}
function write(path: string, method: string, data: object) {
  return apiRequest<Inquiry>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
export function deleteFaq(item: Inquiry) {
  return apiRequest(`/api/admin/inquiries/faqs/${item.id}?version=${item.version}`, {
    method: 'DELETE',
  });
}
