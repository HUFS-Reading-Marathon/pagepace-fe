import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { getApiErrorMessage } from '../../api/apiClient';
import { searchBooks } from '../../api/bookApi';
import {
  bookInquiryWritePath,
  bookSearchInquiryHint,
} from '../../pages/inquiries/bookInquiryState';
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
function BookSearchField({ query, selectedBook, onQueryChange, onSelect }: BookSearchFieldProps) {
  const [manualSearch, setManualSearch] = useState<{ title: string } | null>(null);
  const [response, setResponse] = useState({
    query: '',
    results: [] as BookSearchResult[],
    message: '',
    /** 검색은 성공했지만 결과가 없음(검색 오류와 구분) */
    empty: false,
  });
  const [loadingQuery, setLoadingQuery] = useState('');
  const requestSequenceRef = useRef(0);
  const normalizedQuery = query.trim();
  const searchQuery =
    normalizedQuery.length >= SEARCH_MIN_LENGTH || manualSearch?.title === normalizedQuery
      ? normalizedQuery
      : '';
  const waiting = !!searchQuery && loadingQuery === searchQuery;
  const answered = !selectedBook && !!searchQuery && response.query === searchQuery && !waiting;
  const inquiryHint = answered ? bookSearchInquiryHint(response) : '';

  useEffect(() => {
    if (selectedBook || !searchQuery) {
      return;
    }

    const sequence = ++requestSequenceRef.current;
    const timeoutId = window.setTimeout(() => {
      setLoadingQuery(searchQuery);

      searchBooks(searchQuery)
        .then((nextResults) => {
          if (requestSequenceRef.current !== sequence) return;
          setResponse({
            query: searchQuery,
            results: nextResults,
            message: nextResults.length ? '' : '검색 결과가 없습니다.',
            empty: !nextResults.length,
          });
        })
        .catch((error: unknown) => {
          if (requestSequenceRef.current !== sequence) return;
          setResponse({
            query: searchQuery,
            results: [],
            message: getApiErrorMessage(error, '도서를 검색하지 못했습니다.'),
            empty: false,
          });
        })
        .finally(() => {
          if (requestSequenceRef.current === sequence) {
            setLoadingQuery('');
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      requestSequenceRef.current += 1;
    };
  }, [searchQuery, selectedBook, manualSearch]);

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
            onChange={(event) => {
              setManualSearch(null);
              onQueryChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !selectedBook && normalizedQuery.length === 1) {
                event.preventDefault();
                if (!event.nativeEvent.isComposing && !waiting)
                  setManualSearch({ title: normalizedQuery });
              }
            }}
            placeholder="책 제목 또는 ISBN을 입력해 주세요"
            autoComplete="off"
          />
          {waiting && !selectedBook && <span className="reading-book-search-spinner" />}
        </div>
      </label>

      {/* 검색 결과가 없거나 쪽수를 확인할 수 없는 책만 있으면 도서 문의로 안내하고, 입력한 제목·ISBN을 넘깁니다. */}
      {inquiryHint && (
        <p className="reading-book-search-guide reading-book-search-inquiry" role="status">
          {inquiryHint} <Link to={bookInquiryWritePath(normalizedQuery)}>도서 문의하기</Link>
        </p>
      )}
      {!selectedBook && normalizedQuery.length === 1 && (
        <div className="reading-book-search-guide">
          <button
            type="button"
            disabled={waiting}
            onClick={() => setManualSearch({ title: normalizedQuery })}
          >
            한 글자 제목 검색
          </button>{' '}
          책 뒷면의 ISBN으로도 검색할 수 있습니다.
        </div>
      )}

      {answered && (
        <div
          className="reading-book-search-results"
          role={response.message ? undefined : 'listbox'}
        >
          {response.message ? (
            <p className="reading-book-search-empty">{response.message}</p>
          ) : (
            response.results.map((result) => (
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
                    {result.libraries.length > 0 ? ` · ${result.libraries.join(', ')}` : ''}
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
