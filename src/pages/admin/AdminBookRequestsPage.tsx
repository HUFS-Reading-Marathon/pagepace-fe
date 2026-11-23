import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { getAdminEvents } from '../../api/adminEventApi';
import { searchBooks } from '../../api/bookApi';
import {
  approveBookRequest,
  getBookRequests,
  rejectBookRequest,
  REQUEST_REASON_LABELS,
  REQUEST_STATUS_LABELS,
  type BookRequest,
} from '../../api/bookRequestApi';
import { getApiErrorMessage } from '../../api/apiClient';
import { preferredAdminEvent } from '../../utils/eventSelection';
import { useAdminEventState } from '../../hooks/useAdminEventState';
import type { AdminEvent } from '../../types/adminEvent';
import type { BookSearchResult } from '../../types/book';
import '../logs/book-requests.css';

function RequestReview({
  row,
  onChange,
}: {
  row: BookRequest;
  onChange: (updated: BookRequest) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(row.isbn || row.title);
  const [found, setFound] = useState<BookSearchResult[]>([]);
  const [selected, setSelected] = useState<BookSearchResult | null>(null);
  const [total, setTotal] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const search = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setSelected(null);
    setFound([]);
    setMessage('');
    try {
      const books = await searchBooks(query);
      setFound(books);
      if (!books.length)
        setMessage('일치하는 소장 자료가 없습니다. 제목이나 ISBN을 확인해 주세요.');
    } catch (error) {
      setMessage(getApiErrorMessage(error, '서지를 조회하지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  };
  const review = async (accept: boolean) => {
    if (
      busy ||
      (accept &&
        (!selected || !Number.isSafeInteger(Number(total)) || Number(total) < row.readPages)) ||
      (!accept && !reason.trim())
    )
      return;
    if (
      !window.confirm(
        accept
          ? `${row.participantName}님의 ${row.readPages}쪽을 확인한 판본으로 일반 일지 심사에 보낼까요?`
          : '사유와 함께 확인 요청을 반려할까요?',
      )
    )
      return;
    setBusy(true);
    setMessage('');
    try {
      const updated =
        accept && selected
          ? await approveBookRequest(row.id, {
              libraryBookId: selected.libraryBookId,
              bookTitle: selected.title,
              totalBookPages: Number(total),
              author: selected.author,
              publisher: selected.publisher,
              isbn: selected.isbn,
              callNo: selected.callNo,
              coverImageUrl: selected.thumbnailUrl,
            })
          : await rejectBookRequest(row.id, reason.trim());
      onChange(updated);
      setOpen(false);
    } catch (error) {
      setMessage(getApiErrorMessage(error, '요청을 처리하지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <article>
      <h3>{row.title}</h3>
      <p>
        {row.participantName} · {row.studentNo} · {row.readingDate} · {row.readPages}쪽 ·{' '}
        {REQUEST_STATUS_LABELS[row.status]}
      </p>
      <p>
        {REQUEST_REASON_LABELS[row.reason]} ·{' '}
        {[row.author, row.publisher, row.isbn].filter(Boolean).join(' / ')}
      </p>
      {row.note && <p>{row.note}</p>}
      {row.rejectReason && <p>반려 사유 · {row.rejectReason}</p>}
      {row.readingLogId && (
        <Link to={`/admin/logs?eventId=${row.eventId}&logId=${row.readingLogId}`}>
          이관된 일지 검토
        </Link>
      )}
      {row.status === 'PENDING' && (
        <button
          type="button"
          className="admin-button"
          onClick={() => setOpen(!open)}
          disabled={busy}
        >
          {open ? '검토 접기' : '판본 확인·처리'}
        </button>
      )}
      {open && row.status === 'PENDING' && (
        <>
          <form onSubmit={search}>
            <label>
              소장 도서 또는 ISBN
              <input
                required
                value={query}
                disabled={busy}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setFound([]);
                  setSelected(null);
                }}
              />
            </label>
            <button disabled={busy || !query.trim()}>소장 서지 검색</button>
          </form>
          {found.length > 0 && (
            <label>
              확인한 실물 판본
              <select
                value={selected?.libraryBookId ?? ''}
                disabled={busy}
                onChange={(e) => {
                  const next =
                    found.find((b) => b.libraryBookId === Number(e.target.value)) ?? null;
                  setSelected(next);
                  setTotal(next?.pageCount ? String(next.pageCount) : '');
                }}
              >
                <option value="">판본 선택</option>
                {found.map((b) => (
                  <option value={b.libraryBookId} key={b.libraryBookId}>
                    {[b.title, b.author, b.publisher, b.isbn].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selected && (
            <>
              <label>
                확인한 종이책 총쪽수
                <input
                  type="number"
                  min={row.readPages}
                  value={total}
                  disabled={busy}
                  onChange={(e) => setTotal(e.target.value)}
                />
              </label>
              <button
                disabled={
                  busy || !Number.isSafeInteger(Number(total)) || Number(total) < row.readPages
                }
                onClick={() => void review(true)}
              >
                일지 심사로 이관
              </button>
            </>
          )}
          <label>
            반려 사유
            <textarea
              maxLength={1000}
              value={reason}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button disabled={busy || !reason.trim()} onClick={() => void review(false)}>
            요청 반려
          </button>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </article>
  );
}

export default function AdminBookRequestsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventId, setEventId] = useAdminEventState();
  const [rows, setRows] = useState<BookRequest[]>([]);
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    getAdminEvents()
      .then((list) => {
        if (active) {
          setEvents(list);
          setEventId(preferredAdminEvent(list)?.eventId ?? null);
        }
      })
      .catch((e) => {
        if (active) setMessage(getApiErrorMessage(e, '행사를 조회하지 못했습니다.'));
      });
    return () => {
      active = false;
    };
  }, [setEventId]);
  useEffect(() => {
    if (!eventId) return;
    let active = true;
    getBookRequests(eventId, true)
      .then((list) => {
        if (active) {
          setRows(list);
          setMessage(list.length ? '' : '이 행사의 도서 확인 요청이 없습니다.');
        }
      })
      .catch((e) => {
        if (active) setMessage(getApiErrorMessage(e, '요청을 조회하지 못했습니다.'));
      });
    return () => {
      active = false;
    };
  }, [eventId, reload]);
  return (
    <section className="admin-page book-requests">
      <h1>도서 확인 요청</h1>
      <label>
        관리 행사
        <select
          value={eventId ?? ''}
          onChange={(e) => {
            setRows([]);
            setMessage('');
            setEventId(Number(e.target.value));
          }}
        >
          {events.map((e) => (
            <option value={e.eventId} key={e.eventId}>
              {e.title}
            </option>
          ))}
        </select>
      </label>
      <button className="admin-button" onClick={() => setReload((n) => n + 1)}>
        목록 새로고침
      </button>
      {message && <p role="status">{message}</p>}
      {rows.map((row) => (
        <RequestReview
          key={row.id}
          row={row}
          onChange={(updated) =>
            setRows((previous) => previous.map((item) => (item.id === updated.id ? updated : item)))
          }
        />
      ))}
    </section>
  );
}
