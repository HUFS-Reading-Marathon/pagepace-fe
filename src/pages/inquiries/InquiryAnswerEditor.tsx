import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '../../api/apiClient';
import { saveAnswer, type Inquiry } from '../../api/inquiryApi';
import { formatKoDateTime24 } from '../../utils/date';

const LEAVE_WITH_DRAFT =
  '작성 중인 답변이 있습니다. 이동하면 입력한 내용이 사라집니다. 이동할까요?';

type Props = {
  item: Inquiry;
  saved: (message: string) => void;
  close: () => void;
};

/**
 * 관리자 문의 답변 화면: 목록으로 → 문의 제목 → 작성자·등록일·처리 상태 → 문의 본문 → 답변 작성.
 * 답변이 있으면 수정, 없으면 등록합니다. 저장에 실패해도 입력한 답변은 그대로 둡니다.
 */
export default function InquiryAnswerEditor({ item, saved, close }: Props) {
  const id = useId();
  const initial = item.answer ?? '';
  const [content, setContent] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const editing = !!item.answer;
  const dirty = content.trim() !== initial.trim();

  // 작성 중에 새로고침하거나 창을 닫으면 브라우저 확인 창을 띄웁니다.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const leave = () => {
    if (busy) return;
    if (dirty && !window.confirm(LEAVE_WITH_DRAFT)) return;
    close();
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || !content.trim()) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await saveAnswer(item, content);
      saved(editing ? '답변을 수정했습니다.' : '답변을 등록했습니다.');
    } catch (err) {
      setError(getApiErrorMessage(err, '답변을 저장하지 못했습니다.'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <article className="qa-reply" aria-labelledby={`${id}-title`}>
      <button type="button" className="admin-button qa-reply__back" disabled={busy} onClick={leave}>
        <span aria-hidden="true">←</span> 목록으로
      </button>

      <div className="qa-reply__sheet">
        <header className="qa-reply__head">
          <h2 id={`${id}-title`}>{item.title}</h2>
          <p className="qa-reply__meta">
            {item.authorName && <span>{item.authorName}</span>}
            <span>
              등록 <time dateTime={item.createdAt}>{formatKoDateTime24(item.createdAt)}</time>
            </span>
            <span className="qa-reply__status" data-answered={item.answer ? '' : undefined}>
              {item.answer ? '답변 완료' : '처리 전'}
            </span>
            {item.answeredAt && (
              <span>
                답변 <time dateTime={item.answeredAt}>{formatKoDateTime24(item.answeredAt)}</time>
              </span>
            )}
          </p>
        </header>

        <div className="qa-reply__question">{item.content}</div>

        <form className="qa-reply__form" onSubmit={submit}>
          <label htmlFor={`${id}-answer`}>답변 작성</label>
          <textarea
            id={`${id}-answer`}
            autoFocus
            required
            maxLength={4000}
            rows={7}
            placeholder="문의에 대한 답변을 입력해 주세요."
            value={content}
            disabled={busy}
            onChange={(event) => setContent(event.target.value)}
          />
          {error && (
            <p className="qa-reply__error" role="alert">
              {error}
            </p>
          )}
          <div className="qa-reply__actions">
            <button type="button" className="admin-button" disabled={busy} onClick={leave}>
              취소
            </button>
            <button
              type="submit"
              className="admin-button admin-button--primary"
              disabled={busy || !content.trim()}
            >
              {busy ? '저장 중…' : editing ? '답변 수정' : '답변 등록'}
            </button>
          </div>
        </form>
      </div>
    </article>
  );
}
