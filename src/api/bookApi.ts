import type { BookSearchResult } from '../types/book';
import type { AdminReadingLogBookResponse } from '../types/adminReadingLogApi';
import { ApiError, apiRequest } from './apiClient';

async function searchLibraryCatalog(query: string, signal?: AbortSignal) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new ApiError('검색어를 입력해 주세요.', 0, 'INVALID_BOOK_QUERY');
  }

  const searchParams = new URLSearchParams({ query: normalizedQuery });
  const books = await apiRequest<BookSearchResult[]>(
    `/api/books/search?${searchParams.toString()}`,
    { method: 'GET', signal },
  );
  return books ?? [];
}

type ReviewBook = Pick<AdminReadingLogBookResponse, 'libraryBookId' | 'isbn' | 'bookTitle'>;

export async function lookupReviewBook(book: ReviewBook, signal: AbortSignal) {
  const isbn = (book.isbn ?? '').replace(/[\s-]/g, '').toUpperCase();
  if (!isbn && !book.libraryBookId) return null;
  const queries = [...new Set([isbn, book.bookTitle.trim()].filter(Boolean))];
  for (const query of queries) {
    const books = await searchLibraryCatalog(query, signal);
    if (book.libraryBookId) {
      const match = books.find((hit) => hit.libraryBookId === book.libraryBookId);
      if (match) return match;
    } else {
      const matches = books.filter((hit) => hit.isbn?.replace(/[\s-]/g, '').toUpperCase() === isbn);
      return matches.length === 1 ? matches[0] : null;
    }
  }
  return null;
}

export async function searchBooks(query: string) {
  const books = await searchLibraryCatalog(query);

  return Promise.all(
    books.map(async (book) => {
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
