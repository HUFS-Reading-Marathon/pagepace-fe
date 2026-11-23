import { expect, it, vi } from 'vitest';
import { apiRequest } from '../src/api/apiClient';
import { loadInquiryPage } from '../src/api/inquiryApi';

vi.mock('../src/api/apiClient', () => ({ apiRequest: vi.fn(), ApiError: class extends Error {} }));

it('처리 전 문의가 여러 페이지여도 오래된 순으로 누락이나 중복 없이 이어진다', async () => {
  const items = Array.from({ length: 32 }, (_, index) => ({ id: 32 - index }));
  vi.mocked(apiRequest).mockImplementation(async (path) => {
    const query = new URL(path, 'http://localhost').searchParams;
    expect(query.get('pending')).toBe('true');
    const page = Number(query.get('page'));
    return { items: items.slice(page * 15, (page + 1) * 15), total: 32, pages: 3 };
  });
  const result = await Promise.all(
    [0, 1, 2].map((page) => loadInquiryPage('pending', true, '', page, true)),
  );
  expect(result.map((page) => page.items.length)).toEqual([15, 15, 2]);
  expect(result.flatMap((page) => page.items.map((item) => item.id))).toEqual(
    Array.from({ length: 32 }, (_, index) => index + 1),
  );
});
