import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getApiErrorMessage } from '../../api/apiClient';
import { getCurrentParticipation } from '../../api/participationApi';
import {
  getBookRequests,
  sendBookRequest,
  REQUEST_REASON_LABELS,
  REQUEST_STATUS_LABELS,
  type BookRequest,
  type NewBookRequest,
} from '../../api/bookRequestApi';
import { canSubmitReadingLog, koreaToday } from '../../utils/eventSelection';
import type { MyParticipation } from '../../types/participation';
import './book-requests.css';

function emptyRequest(): Omit<NewBookRequest, 'participationId' | 'readPages'> & {
  readPages: string;
} {
  return {
    readingDate: koreaToday(),
    readPages: '',
    reason: 'UNKNOWN_PAGES',
    title: '',
    author: '',
    publisher: '',
    isbn: '',
    note: '',
  };
}
export default function BookRequestsPage() {
  const [params] = useSearchParams();
  const [participation, setParticipation] = useState<MyParticipation | null>(null);
  const [rows, setRows] = useState<BookRequest[]>([]);
  const [form, setForm] = useState(() => ({ ...emptyRequest(), title: params.get('title') ?? '' }));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    getCurrentParticipation()
      .then(async (p) => {
        const list = await getBookRequests(p.eventId);
        if (active) {
          setParticipation(p);
          setRows(list);
          setMessage('');
        }
      })
      .catch((e) => {
        if (active) setMessage(getApiErrorMessage(e, '도서 확인 요청을 조회하지 못했습니다.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!participation || busy || !form.title.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      const saved = await sendBookRequest({
        ...form,
        title: form.title.trim(),
        participationId: participation.participationId,
        readPages: Number(form.readPages),
      });
      setRows((existing) => [saved, ...existing.filter((r) => r.id !== saved.id)]);
      setForm(emptyRequest());
      setMessage('도서 확인 요청을 접수했습니다.');
    } catch (error) {
      setMessage(getApiErrorMessage(error, '요청을 접수하지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main id="main" className="page-container book-requests">
      {participation && canSubmitReadingLog(participation) ? (
        <Link to="/logs/new">독서일지 작성으로</Link>
      ) : (
        <Link to="/logs">내 독서일지 보기</Link>
      )}
      <h1>도서 확인 요청</h1>
      <p>
        검색되지 않는 도서, 쪽수가 없는 판본, 전자책의 독서 날짜와 분량을 남겨 주세요. 담당자가 실물
        판본을 확인하면 해당 기록이 독서일지 심사로 넘어갑니다.
      </p>
      {message && <p role="status">{message}</p>}
      {loading ? (
        <p role="status">요청 내역을 불러오는 중입니다.</p>
      ) : !participation ? (
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setReload((v) => v + 1);
          }}
        >
          참가 정보 다시 불러오기
        </button>
      ) : (
        <>
          <h2>{participation.eventTitle}</h2>
          {canSubmitReadingLog(participation) ? (
            <form onSubmit={submit}>
              <fieldset disabled={busy}>
                <label>
                  요청 사유
                  <select
                    value={form.reason}
                    onChange={(e) =>
                      setForm({ ...form, reason: e.target.value as NewBookRequest['reason'] })
                    }
                  >
                    {Object.entries(REQUEST_REASON_LABELS).map(([key, title]) => (
                      <option value={key} key={key}>
                        {title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  도서명
                  <input
                    required
                    maxLength={500}
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </label>
                <label>
                  독서 날짜
                  <input
                    required
                    type="date"
                    min={participation.eventStartDate}
                    max={
                      participation.eventEndDate < koreaToday()
                        ? participation.eventEndDate
                        : koreaToday()
                    }
                    value={form.readingDate}
                    onChange={(e) => setForm({ ...form, readingDate: e.target.value })}
                  />
                </label>
                <label>
                  읽은 쪽수
                  <input
                    required
                    type="number"
                    min={1}
                    max={400}
                    value={form.readPages}
                    onChange={(e) => setForm({ ...form, readPages: e.target.value })}
                  />
                </label>
                {(
                  [
                    ['author', '저자'],
                    ['publisher', '출판사'],
                    ['isbn', 'ISBN'],
                  ] as const
                ).map(([key, title]) => (
                  <label key={key}>
                    {title} (선택)
                    <input
                      maxLength={key === 'isbn' ? 50 : 255}
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  </label>
                ))}
                <label>
                  판본·확인 요청 사항 (선택)
                  <textarea
                    maxLength={1000}
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                  />
                </label>
                <button className="btn btn-primary">도서 확인 요청 제출</button>
              </fieldset>
            </form>
          ) : (
            <p>이 회차의 접수가 닫혀 있습니다. 기존 요청 내역은 아래에서 확인할 수 있습니다.</p>
          )}
          <h2>내 요청 내역</h2>
          {!rows.length && <p>아직 제출한 요청이 없습니다.</p>}
          {rows.map((r) => (
            <article key={r.id}>
              <h3>{r.title}</h3>
              <p>
                {r.readingDate} · {r.readPages}쪽 · {REQUEST_STATUS_LABELS[r.status]}
              </p>
              {r.rejectReason && <p>반려 사유 · {r.rejectReason}</p>}
              {r.readingLogId && <Link to={`/logs/${r.readingLogId}`}>이관된 일지 확인</Link>}
            </article>
          ))}
        </>
      )}
    </main>
  );
}
