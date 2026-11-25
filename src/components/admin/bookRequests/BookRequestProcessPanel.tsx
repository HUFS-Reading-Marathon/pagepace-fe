import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '../../../api/apiClient';
import { searchBooks } from '../../../api/bookApi';
import type { BookRequest, ConfirmedCatalogBook } from '../../../api/bookRequestApi';
import type { BookSearchResult } from '../../../types/book';
import './book-request-admin.css';

type Props = {
  request: BookRequest;
  /** 승인·반려를 서버에 보내는 중 */
  processing: boolean;
  /** 서버 처리 결과. 실패하면 false를 돌려주며, 입력한 값은 그대로 둡니다. */
  onApprove: (book: ConfirmedCatalogBook) => Promise<boolean>;
  onReject: (reason: string) => Promise<boolean>;
  /** 반려 사유·총쪽수 등 처리 전 입력이 있는지 (다른 요청으로 이동할 때 확인) */
  onDraftChange?: (dirty: boolean) => void;
};

type SearchState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'done'; books: BookSearchResult[] }
  | { kind: 'error'; message: string };

const isValidTotal = (total: string, readPages: number) =>
  /^\d+$/.test(total) && Number.isSafeInteger(Number(total)) && Number(total) >= readPages;

/**
 * 확인 대기 요청의 처리 영역. 소장 서지를 찾아 실물 판본과 종이책 총쪽수를 확인하면 일지 심사로 이관하고,
 * 확인할 수 없으면 사유와 함께 반려합니다. 판본 선택·총쪽수(요청 독서량 이상) 조건은 기존과 같습니다.
 */
export default function BookRequestProcessPanel({
  request,
  processing,
  onApprove,
  onReject,
  onDraftChange,
}: Props) {
  const id = useId();
  const [query, setQuery] = useState(request.isbn || request.title);
  const [search, setSearch] = useState<SearchState>({ kind: 'idle' });
  const [selected, setSelected] = useState<BookSearchResult | null>(null);
  const [total, setTotal] = useState('');
  const [reason, setReason] = useState('');
  const searching = useRef(false);
  const dirty = !!reason.trim() || !!selected;

  useEffect(() => {
    onDraftChange?.(dirty);
  }, [dirty, onDraftChange]);
  useEffect(() => () => onDraftChange?.(false), [onDraftChange]);

  const runSearch = async (event: FormEvent) => {
    event.preventDefault();
    const keyword = query.trim();
    // 검색 중 다시 누르거나 Enter를 반복해도 요청을 한 번만 보냅니다.
    if (!keyword || searching.current || processing) return;
    searching.current = true;
    setSearch({ kind: 'searching' });
    setSelected(null);
    setTotal('');
    try {
      setSearch({ kind: 'done', books: await searchBooks(keyword) });
    } catch (error) {
      const detail = getApiErrorMessage(error, '');
      // 검색 결과 없음과 구분되도록 검색 자체가 실패했음을 먼저 알립니다.
      setSearch({
        kind: 'error',
        message: `소장 서지를 검색하지 못했습니다.${detail ? ` ${detail}` : ''} 잠시 후 다시 검색해 주세요.`,
      });
    } finally {
      searching.current = false;
    }
  };

  const choose = (book: BookSearchResult) => {
    setSelected(book);
    setTotal(book.pageCount ? String(book.pageCount) : '');
  };

  const canApprove = !!selected && isValidTotal(total, request.readPages) && !processing;
  const approve = async () => {
    if (!canApprove || !selected) return;
    if (
      !window.confirm(
        `${request.participantName}님의 ${request.readPages}쪽을 확인한 판본으로 일반 일지 심사에 보낼까요?`,
      )
    )
      return;
    await onApprove({
      libraryBookId: selected.libraryBookId,
      bookTitle: selected.title,
      totalBookPages: Number(total),
      author: selected.author,
      publisher: selected.publisher,
      isbn: selected.isbn,
      callNo: selected.callNo,
      coverImageUrl: selected.thumbnailUrl,
    });
  };

  const reject = async () => {
    if (!reason.trim() || processing) return;
    if (!window.confirm('사유와 함께 확인 요청을 반려할까요?')) return;
    await onReject(reason.trim());
  };

  const isSearching = search.kind === 'searching';
  const totalTooSmall = !!selected && total !== '' && !isValidTotal(total, request.readPages);

  return (
    <div className="book-request-process">
      <section className="book-request-process__block" aria-labelledby={`${id}-catalog`}>
        <h3 id={`${id}-catalog`}>소장 서지 확인</h3>
        <form className="book-request-process__search" onSubmit={runSearch}>
          <label className="sr-only" htmlFor={`${id}-query`}>
            소장 도서명 또는 ISBN
          </label>
          <input
            id={`${id}-query`}
            type="search"
            placeholder="소장 도서명 또는 ISBN"
            value={query}
            disabled={processing}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="submit"
            className="admin-button"
            disabled={processing || isSearching || !query.trim()}
            aria-busy={isSearching || undefined}
          >
            {isSearching ? '검색 중…' : '소장 서지 검색'}
          </button>
        </form>

        <div aria-live="polite">
          {search.kind === 'error' && (
            <p className="book-request-process__message" data-tone="error" role="alert">
              {search.message}
            </p>
          )}
          {search.kind === 'done' && !search.books.length && (
            <p className="book-request-process__message" role="status">
              일치하는 소장 자료가 없습니다.
            </p>
          )}
        </div>

        {search.kind === 'done' && search.books.length > 0 && (
          <fieldset className="book-request-process__results" disabled={processing}>
            <legend>
              확인한 실물 판본 <small>{search.books.length.toLocaleString()}건</small>
            </legend>
            {search.books.map((book) => (
              <label
                key={book.libraryBookId}
                data-selected={selected?.libraryBookId === book.libraryBookId || undefined}
              >
                <input
                  type="radio"
                  name={`${id}-edition`}
                  checked={selected?.libraryBookId === book.libraryBookId}
                  onChange={() => choose(book)}
                />
                <span>
                  <strong>{book.title}</strong>
                  <span>
                    {[book.author, book.publisher, book.isbn && `ISBN ${book.isbn}`]
                      .filter(Boolean)
                      .join(' · ') || '서지 정보 없음'}
                  </span>
                </span>
                <span className="book-request-process__meta">
                  {book.pageCount ? `${book.pageCount.toLocaleString('ko-KR')}쪽` : '쪽수 없음'}
                  {book.callNo && <small>{book.callNo}</small>}
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {selected && (
          <div className="book-request-process__approve">
            <label htmlFor={`${id}-total`}>확인한 종이책 총쪽수</label>
            <div className="book-request-process__row">
              <input
                id={`${id}-total`}
                type="number"
                inputMode="numeric"
                min={request.readPages}
                value={total}
                disabled={processing}
                aria-invalid={totalTooSmall || undefined}
                aria-describedby={`${id}-total-hint`}
                onChange={(e) => setTotal(e.target.value)}
              />
              <button
                type="button"
                className="admin-button admin-button--primary"
                disabled={!canApprove}
                onClick={() => void approve()}
              >
                {processing ? '처리 중…' : '일지 심사로 이관'}
              </button>
            </div>
            <p
              id={`${id}-total-hint`}
              className="book-request-process__hint"
              data-tone={totalTooSmall ? 'error' : undefined}
            >
              요청 독서량 {request.readPages.toLocaleString('ko-KR')}쪽 이상
            </p>
          </div>
        )}
      </section>

      <section className="book-request-process__block" aria-labelledby={`${id}-reject`}>
        <h3 id={`${id}-reject`}>요청 반려</h3>
        <label className="sr-only" htmlFor={`${id}-reason`}>
          반려 사유
        </label>
        <textarea
          id={`${id}-reason`}
          rows={3}
          maxLength={1000}
          placeholder="반려 사유"
          value={reason}
          disabled={processing}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="book-request-process__actions">
          <span className="book-request-process__hint">
            {reason.length.toLocaleString()} / 1,000
          </span>
          <button
            type="button"
            className="admin-button admin-button--danger"
            disabled={processing || !reason.trim()}
            onClick={() => void reject()}
          >
            {processing ? '처리 중…' : '요청 반려'}
          </button>
        </div>
      </section>
    </div>
  );
}
