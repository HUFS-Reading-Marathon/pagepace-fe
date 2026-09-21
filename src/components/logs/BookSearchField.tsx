import { useEffect, useRef, useState } from 'react';
import { getApiErrorMessage } from '../../api/apiClient';
import { searchBooks } from '../../api/bookApi';
import type { BookSearchResult } from '../../types/book';
import BookCover from './BookCover';

const SEARCH_MIN_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 350;

type BookSearchFieldProps = {
  query: string;
  selectedBook: BookSearchResult | null;
  onQueryChange: (query: string) => void;
  onSelect: (book: BookSearchResult) => void;
};

/** 도서관 소장 도서 검색 입력 + 자동완성 결과 목록 */
function BookSearchField({
  query,
  selectedBook,
  onQueryChange,
  onSelect,
}: BookSearchFieldProps) {
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const requestSequenceRef = useRef(0);
  const normalizedQuery = query.trim();

  useEffect(() => {
    const searchQuery = query.trim();

    if (selectedBook || searchQuery.length < SEARCH_MIN_LENGTH) {
      return;
    }

    const sequence = ++requestSequenceRef.current;
    const timeoutId = window.setTimeout(() => {
      setIsSearching(true);
      setResults([]);
      setSearchMessage('');

      searchBooks(searchQuery)
        .then((nextResults) => {
          if (requestSequenceRef.current !== sequence) return;
          setResults(nextResults);
          setSearchMessage(
            nextResults.length === 0 ? '검색 결과가 없습니다.' : '',
          );
        })
        .catch((error: unknown) => {
          if (requestSequenceRef.current !== sequence) return;
          setResults([]);
          setSearchMessage(
            getApiErrorMessage(error, '도서를 검색하지 못했습니다.'),
          );
        })
        .finally(() => {
          if (requestSequenceRef.current === sequence) {
            setIsSearching(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      requestSequenceRef.current += 1;
    };
  }, [query, selectedBook]);

  return (
    <div className="reading-book-search">
      <label className="reading-log-field">
        <span>
          도서 검색 <em>*</em>
        </span>
        <div className="reading-book-search-input">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m16.5 16.5 4 4" />
          </svg>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="책 제목 또는 ISBN을 입력해 주세요"
            autoComplete="off"
          />
          {isSearching &&
            !selectedBook &&
            normalizedQuery.length >= SEARCH_MIN_LENGTH && (
              <span className="reading-book-search-spinner" />
            )}
        </div>
      </label>

      {!selectedBook && normalizedQuery.length === 1 && (
        <p className="reading-book-search-guide">두 글자 이상 입력하면 자동으로 검색합니다.</p>
      )}

      {!selectedBook &&
        normalizedQuery.length >= SEARCH_MIN_LENGTH &&
        (results.length > 0 || searchMessage) && (
          <div className="reading-book-search-results" role="listbox">
            {searchMessage ? (
              <p className="reading-book-search-empty">{searchMessage}</p>
            ) : (
              results.map((result) => (
                <button
                  key={result.libraryBookId}
                  type="button"
                  className="reading-book-search-result"
                  onClick={() => onSelect(result)}
                  disabled={!result.pageCount}
                  role="option"
                  aria-selected="false"
                >
                  <span className="reading-book-search-cover">
                    <BookCover book={result} />
                  </span>
                  <span className="reading-book-search-copy">
                    <strong>{result.title}</strong>
                    <span>
                      {result.author || '저자 미상'}
                      {result.publisher ? ` · ${result.publisher}` : ''}
                    </span>
                    <small>
                      {result.pageCount
                        ? `${result.pageCount.toLocaleString()}쪽`
                        : '전체 페이지 정보 없음'}
                      {result.libraries.length > 0
                        ? ` · ${result.libraries.join(', ')}`
                        : ''}
                    </small>
                  </span>
                  <span className="reading-book-search-select">
                    {result.pageCount ? '선택' : '선택 불가'}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
    </div>
  );
}

export default BookSearchField;
