import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { isAdminRole, useAuth } from '../../auth';
import { getApiErrorMessage } from '../../api/apiClient';
import { REQUEST_REASON_LABELS, sendBookRequest } from '../../api/bookRequestApi';
import { getCurrentParticipation } from '../../api/participationApi';
import UserPageHeader from '../../components/layout/UserPageHeader';
import { LEAVE_MESSAGE, useLeaveGuard } from '../../hooks/useLeaveGuard';
import type { MyParticipation } from '../../types/participation';
import { formatKoDateKey } from '../../utils/date';
import { canSubmitReadingLog, koreaToday } from '../../utils/eventSelection';
import {
  bookInquiryErrors,
  readBookInquiryPrefill,
  type BookInquiryForm,
} from './bookInquiryState';
import type { InquiryBoardLinkState } from './UserInquiryBoard';
import '../main/MainPage.css';
import './user-inquiries.css';

const LIST_PATH = '/inquiries?view=books';
const NOTE_MAX = 1000;
const REASONS = Object.entries(REQUEST_REASON_LABELS) as [
  BookInquiryForm['reason'] & string,
  string,
][];

type Loaded = { participation?: MyParticipation; error?: string };

/**
 * 도서 문의 작성: 검색되지 않거나 쪽수를 확인할 수 없는 책의 오늘 독서 기록을 남깁니다.
 * 기존 도서 확인 요청 API(POST /api/me/book-requests)를 그대로 쓰며, 독서 날짜는 서버가 한국 시간 오늘로 정합니다.
 */
export default function BookInquiryWritePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [initial] = useState(() => readBookInquiryPrefill(params));
  const [form, setForm] = useState<BookInquiryForm>({
    title: initial.title,
    readPages: '',
    reason: '',
    isbn: initial.isbn,
    note: '',
  });
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const isAdmin = !!user && isAdminRole(user.role);
  // 주소로 미리 채운 값은 학생이 입력한 내용이 아니므로, 그대로 두고 나가면 확인하지 않습니다.
  const dirty =
    form.title.trim() !== initial.title ||
    form.isbn.trim() !== initial.isbn ||
    !!form.readPages.trim() ||
    !!form.reason ||
    !!form.note.trim();
  useLeaveGuard(dirty && !busy, LEAVE_MESSAGE);

  useEffect(() => {
    if (isAdmin) return;
    let active = true;
    getCurrentParticipation()
      .then((participation) => {
        if (active) setLoaded({ participation });
      })
      .catch((err) => {
        if (active)
          setLoaded({ error: getApiErrorMessage(err, '참가 정보를 불러오지 못했습니다.') });
      });
    return () => {
      active = false;
    };
  }, [attempt, isAdmin]);

  if (isAdmin) {
    return (
      <main id="main" className="wrap user-page inquiry-write">
        <UserPageHeader title="도서 문의 작성" />
        <p className="inquiry-board__message">
          관리자 계정은 도서 문의를 작성할 수 없습니다.{' '}
          <Link to="/admin/inquiries?view=books">도서 문의 관리로 이동</Link>
        </p>
      </main>
    );
  }

  const participation = loaded?.participation;
  const open = !!participation && canSubmitReadingLog(participation);
  const errors = bookInquiryErrors(form);
  const fieldError = (key: keyof BookInquiryForm) => (showErrors ? errors[key] : undefined);
  const set = (patch: Partial<BookInquiryForm>) => setForm((current) => ({ ...current, ...patch }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || !participation || !open) return;
    const invalid = Object.keys(bookInquiryErrors(form))[0];
    if (invalid) {
      setShowErrors(true);
      // 첫 번째로 고칠 입력칸으로 초점을 옮깁니다.
      const target = {
        title: 'bookInquiryTitle',
        readPages: 'bookInquiryPages',
        reason: 'bookInquiryReason0',
      }[invalid as 'title' | 'readPages' | 'reason'];
      document.getElementById(target)?.focus();
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await sendBookRequest({
        participationId: participation.participationId,
        // 서버가 한국 시간 오늘 날짜만 받습니다(자정을 넘기면 서버 안내를 그대로 보여 줍니다).
        readingDate: koreaToday(),
        readPages: Number(form.readPages),
        reason: form.reason as Exclude<BookInquiryForm['reason'], ''>,
        title: form.title.trim(),
        author: '',
        publisher: '',
        isbn: form.isbn.trim(),
        note: form.note.trim(),
      });
      const state: InquiryBoardLinkState = {
        notice:
          '도서 문의를 접수했습니다. 담당자가 판본과 쪽수를 확인하면 독서일지 검토로 넘어갑니다.',
      };
      navigate(LIST_PATH, { replace: true, state });
    } catch (err) {
      // 실패하면 입력한 내용을 그대로 두고 서버 안내(접수 기간, 하루 쪽수 등)를 보여 줍니다.
      setError(getApiErrorMessage(err, '도서 문의를 접수하지 못했습니다. 다시 시도해 주세요.'));
      lock.current = false;
      setBusy(false);
    }
  }

  function cancel() {
    if (dirty && !window.confirm(LEAVE_MESSAGE)) return;
    navigate(LIST_PATH);
  }

  return (
    <main id="main" className="wrap user-page inquiry-write book-inquiry-write">
      <UserPageHeader title="도서 문의 작성" />

      {!loaded ? (
        <p className="inquiry-board__message">참가 정보를 확인하는 중입니다.</p>
      ) : loaded.error ? (
        <p className="inquiry-board__message" role="alert">
          {loaded.error}{' '}
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>
            다시 불러오기
          </button>
        </p>
      ) : !open ? (
        <p className="inquiry-board__message">
          {participation?.eventTitle} 독서일지 접수 기간이 아니어서 도서 문의를 접수할 수 없습니다.{' '}
          <Link to={LIST_PATH}>도서 문의 내역 보기</Link>
        </p>
      ) : (
        <form className="inquiry-write__form" onSubmit={submit} noValidate>
          <p className="book-inquiry-write__intro">
            도서 검색에 나오지 않거나 쪽수를 확인할 수 없는 책을 오늘 읽었다면 남겨 주세요. 담당자가
            소장 판본을 확인하면 접수한 날짜와 쪽수로 독서일지가 만들어지고, 독서일지 검토를 거쳐
            거리에 반영됩니다.
          </p>

          <div className="book-inquiry-write__date">
            <span>접수 날짜</span>
            <strong>
              <time dateTime={koreaToday()}>{formatKoDateKey(koreaToday())}</time>
            </strong>
            <small>한국 시간 기준 오늘 · {participation.eventTitle}</small>
          </div>

          <div className="inquiry-write__field">
            <label htmlFor="bookInquiryTitle">도서명</label>
            <input
              id="bookInquiryTitle"
              required
              maxLength={500}
              value={form.title}
              disabled={busy}
              aria-invalid={!!fieldError('title')}
              aria-describedby={fieldError('title') ? 'bookInquiryTitleError' : undefined}
              onChange={(event) => set({ title: event.target.value })}
            />
            {fieldError('title') && (
              <p id="bookInquiryTitleError" className="book-inquiry-write__field-error">
                {fieldError('title')}
              </p>
            )}
          </div>

          <div className="book-inquiry-write__row">
            <div className="inquiry-write__field">
              <label htmlFor="bookInquiryPages">오늘 읽은 쪽수</label>
              <div className="book-inquiry-write__unit">
                <input
                  id="bookInquiryPages"
                  type="number"
                  inputMode="numeric"
                  required
                  min={1}
                  max={400}
                  value={form.readPages}
                  disabled={busy}
                  aria-invalid={!!fieldError('readPages')}
                  aria-describedby={
                    fieldError('readPages') ? 'bookInquiryPagesError' : 'bookInquiryPagesHint'
                  }
                  onChange={(event) => set({ readPages: event.target.value })}
                />
                <span aria-hidden="true">쪽</span>
              </div>
              {fieldError('readPages') ? (
                <p id="bookInquiryPagesError" className="book-inquiry-write__field-error">
                  {fieldError('readPages')}
                </p>
              ) : (
                <p id="bookInquiryPagesHint" className="inquiry-write__note">
                  하루 최대 400쪽
                </p>
              )}
            </div>
            <div className="inquiry-write__field">
              <label htmlFor="bookInquiryIsbn">ISBN (선택)</label>
              <input
                id="bookInquiryIsbn"
                maxLength={50}
                inputMode="numeric"
                value={form.isbn}
                disabled={busy}
                aria-describedby="bookInquiryIsbnHint"
                onChange={(event) => set({ isbn: event.target.value })}
              />
              <p id="bookInquiryIsbnHint" className="inquiry-write__note">
                책 뒤표지나 판권면의 번호를 알면 입력해 주세요.
              </p>
            </div>
          </div>

          <fieldset
            className="inquiry-write__field"
            disabled={busy}
            aria-invalid={!!fieldError('reason')}
            aria-describedby={fieldError('reason') ? 'bookInquiryReasonError' : undefined}
          >
            <legend>확인이 필요한 이유</legend>
            <div className="inquiry-write__options book-inquiry-write__reasons">
              {REASONS.map(([value, label], index) => (
                <label key={value}>
                  <input
                    id={`bookInquiryReason${index}`}
                    type="radio"
                    name="reason"
                    value={value}
                    checked={form.reason === value}
                    onChange={() => set({ reason: value })}
                  />
                  {label}
                </label>
              ))}
            </div>
            {fieldError('reason') && (
              <p id="bookInquiryReasonError" className="book-inquiry-write__field-error">
                {fieldError('reason')}
              </p>
            )}
          </fieldset>

          <div className="inquiry-write__field">
            <label htmlFor="bookInquiryNote">추가 설명 (선택)</label>
            <div className="inquiry-write__textarea">
              <textarea
                id="bookInquiryNote"
                className="book-inquiry-write__note"
                maxLength={NOTE_MAX}
                value={form.note}
                disabled={busy}
                placeholder="판본, 출판사, 전자책 여부 등 확인에 도움이 되는 내용을 적어 주세요."
                aria-describedby="bookInquiryNoteCount"
                onChange={(event) => set({ note: event.target.value })}
              />
              <p id="bookInquiryNoteCount" className="inquiry-write__count">
                {form.note.length.toLocaleString('ko-KR')} / {NOTE_MAX.toLocaleString('ko-KR')}자
              </p>
            </div>
          </div>

          {error && (
            <p className="inquiry-write__error" role="alert">
              {error}
            </p>
          )}

          <div className="inquiry-write__actions">
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={cancel}>
              취소
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? '접수 중…' : '도서 문의 등록'}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
