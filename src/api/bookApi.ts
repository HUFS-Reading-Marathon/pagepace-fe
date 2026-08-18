import type { BookSearchResult } from '../types/book';
import { ApiError, apiRequest } from './apiClient';

export async function searchBooks(query: string) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new ApiError('검색어를 입력해 주세요.', 0, 'INVALID_BOOK_QUERY');
  }

  const searchParams = new URLSearchParams({ query: normalizedQuery });
  const books = await apiRequest<BookSearchResult[]>(
    `/api/books/search?${searchParams.toString()}`,
    { method: 'GET' },
  );

  return Promise.all(
    (books ?? []).map(async (book) => {
      if (book.thumbnailUrl || !book.isbn) return book;

      try {
        const searchParams = new URLSearchParams({ isbn: book.isbn });
        const thumbnail = await apiRequest<{
          isbn: string;
          thumbnailUrl: string | null;
        }>(`/api/books/thumbnail?${searchParams.toString()}`, {
          method: 'GET',
        });
        return { ...book, thumbnailUrl: thumbnail?.thumbnailUrl ?? null };
      } catch {
        return book;
      }
    }),
  );
}
