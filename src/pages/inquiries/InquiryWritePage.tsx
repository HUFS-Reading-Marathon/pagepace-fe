import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isAdminRole, useAuth } from '../../auth';
import { getApiErrorMessage } from '../../api/apiClient';
import { postQuestion } from '../../api/inquiryApi';
import UserPageHeader from '../../components/layout/UserPageHeader';
import { LEAVE_MESSAGE, useLeaveGuard } from '../../hooks/useLeaveGuard';
import type { InquiryBoardLinkState } from './UserInquiryBoard';
import '../main/MainPage.css';
import './user-inquiries.css';

const TITLE_MAX = 160;
const CONTENT_MAX = 4000;
const MINE_PATH = '/inquiries?view=mine';

/** 문의 작성(로그인한 일반 사용자). 기존 문의 등록 API(POST /api/me/inquiries)를 그대로 씁니다. */
export default function InquiryWritePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [publicEntry, setPublicEntry] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const dirty = !!(title.trim() || content.trim() || publicEntry);
  useLeaveGuard(dirty && !busy, LEAVE_MESSAGE);

  if (user && isAdminRole(user.role)) {
    return (
      <main id="main" className="wrap user-page inquiry-write">
        <UserPageHeader title="문의 작성" />
        <p className="inquiry-board__message">
          관리자 계정은 문의를 작성할 수 없습니다.{' '}
          <Link to="/admin/inquiries">문의 관리로 이동</Link>
        </p>
      </main>
    );
  }

  const canSubmit = !busy && !!title.trim() && !!content.trim();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || !title.trim() || !content.trim()) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await postQuestion(title.trim(), content.trim(), publicEntry);
      const state: InquiryBoardLinkState = {
        notice: '문의를 등록했습니다. 답변이 등록되면 내 문의에서 확인할 수 있습니다.',
      };
      // 등록이 끝났으므로 이동 전 확인 없이 내 문의로 갑니다(입력 상태는 이 화면과 함께 사라집니다).
      navigate(MINE_PATH, { replace: true, state });
    } catch (err) {
      // 실패하면 입력한 내용을 그대로 두고 서버 안내를 보여 줍니다.
      setError(getApiErrorMessage(err, '문의를 등록하지 못했습니다. 다시 시도해 주세요.'));
      lock.current = false;
      setBusy(false);
    }
  }

  function cancel() {
    if (dirty && !window.confirm(LEAVE_MESSAGE)) return;
    navigate('/inquiries');
  }

  return (
    <main id="main" className="wrap user-page inquiry-write">
      <UserPageHeader title="문의 작성" />

      <form className="inquiry-write__form" onSubmit={submit} noValidate>
        <div className="inquiry-write__field">
          <label htmlFor="inquiryTitle">제목</label>
          <input
            id="inquiryTitle"
            required
            maxLength={TITLE_MAX}
            value={title}
            disabled={busy}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="inquiry-write__field">
          <label htmlFor="inquiryContent">문의 내용</label>
          <textarea
            id="inquiryContent"
            required
            rows={12}
            maxLength={CONTENT_MAX}
            value={content}
            disabled={busy}
            aria-describedby="inquiryContentCount"
            onChange={(event) => setContent(event.target.value)}
          />
          <p id="inquiryContentCount" className="inquiry-write__count">
            {content.length.toLocaleString('ko-KR')} / {CONTENT_MAX.toLocaleString('ko-KR')}자
          </p>
        </div>

        <fieldset className="inquiry-write__field inquiry-write__visibility" disabled={busy}>
          <legend>공개 여부</legend>
          <div className="inquiry-write__options">
            <label>
              <input
                type="radio"
                name="publicEntry"
                checked={!publicEntry}
                onChange={() => setPublicEntry(false)}
              />
              비공개
            </label>
            <label>
              <input
                type="radio"
                name="publicEntry"
                checked={publicEntry}
                aria-describedby={publicEntry ? 'inquiryPublicNote' : undefined}
                onChange={() => setPublicEntry(true)}
              />
              공개
            </label>
          </div>
          {publicEntry && (
            <p id="inquiryPublicNote" className="inquiry-write__note">
              관리자 답변이 등록된 뒤 질문과 답변이 공개 문의에 게시됩니다. 작성자 이름은 표시되지
              않습니다.
            </p>
          )}
        </fieldset>

        {error && (
          <p className="inquiry-write__error" role="alert">
            {error}
          </p>
        )}

        <div className="inquiry-write__actions">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={cancel}>
            취소
          </button>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {busy ? '등록 중…' : '문의 등록'}
          </button>
        </div>
      </form>
    </main>
  );
}
