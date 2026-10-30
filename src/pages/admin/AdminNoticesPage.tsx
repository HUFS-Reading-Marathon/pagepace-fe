import { useEffect, useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '../../api/apiClient';
import {
  createAdminNotice,
  deleteAdminNotice,
  getAdminNotices,
  updateAdminNotice,
  type Notice,
  type NoticeRequest,
} from '../../api/noticeApi';
import '../../styles/admin-notices.css';

const EMPTY_FORM: NoticeRequest = {
  title: '',
  content: '',
  pinned: false,
  visible: true,
};

function toNoticeForm(notice: Notice): NoticeRequest {
  return {
    title: notice.title,
    content: notice.content,
    pinned: notice.pinned,
    visible: notice.visible,
  };
}

function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [form, setForm] = useState<NoticeRequest>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () =>
    getAdminNotices()
      .then(setNotices)
      .catch((requestError: unknown) =>
        setError(getApiErrorMessage(requestError, '공지사항을 불러오지 못했습니다.')),
      )
      .finally(() => setLoading(false));

  useEffect(() => {
    void load();
  }, []);

  const start = (notice?: Notice) => {
    setEditing(notice ?? null);
    setForm(notice ? toNoticeForm(notice) : EMPTY_FORM);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      if (editing) {
        await updateAdminNotice(editing.noticeId, form);
      } else {
        await createAdminNotice(form);
      }

      start();
      await load();
      setError('');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '공지사항을 저장하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (notice: Notice) => {
    if (!confirm(`“${notice.title}” 공지를 삭제할까요?`)) {
      return;
    }

    await deleteAdminNotice(notice.noticeId);
    await load();
  };

  return (
    <section className="admin-page admin-notices">
      <header className="admin-page__header admin-notices__header">
        <div>
          <h1>공지사항 관리</h1>
          <p>사용자 메인 화면에 표시할 운영 공지를 작성합니다.</p>
        </div>
      </header>
      {error && <p className="admin-notices__error">{error}</p>}
      <div className="admin-notices__layout">
        <section className="admin-notices__list">
          <header>
            <h2>등록된 공지</h2>
            <span>{notices.length}건</span>
          </header>
          {loading ? (
            <p>불러오는 중입니다.</p>
          ) : (
            notices.map((notice) => (
              <article key={notice.noticeId} className={!notice.visible ? 'is-hidden' : ''}>
                <div>
                  <span>{notice.pinned ? '중요' : '일반'}</span>
                  <strong>{notice.title}</strong>
                  <small>
                    {notice.visible ? '게시 중' : '숨김'} · {notice.authorName}
                  </small>
                </div>
                <div>
                  <button onClick={() => start(notice)}>수정</button>
                  <button onClick={() => void remove(notice)}>삭제</button>
                </div>
              </article>
            ))
          )}
        </section>
        <form className="admin-notices__form" onSubmit={submit}>
          <div>
            <span>{editing ? '공지 수정' : '새 공지'}</span>
            <h2>{editing?.title || '공지사항 작성'}</h2>
          </div>
          <label>
            제목
            <input
              required
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </label>
          <label>
            내용
            <textarea
              required
              rows={10}
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
            />
          </label>
          <div className="admin-notices__checks">
            <label>
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(event) => setForm({ ...form, pinned: event.target.checked })}
              />{' '}
              중요 공지
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.visible}
                onChange={(event) => setForm({ ...form, visible: event.target.checked })}
              />{' '}
              사용자에게 게시
            </label>
          </div>
          <div className="admin-notices__actions">
            <button type="button" onClick={() => start()}>
              초기화
            </button>
            <button type="submit" disabled={saving}>
              {saving ? '저장 중…' : editing ? '변경사항 저장' : '공지 등록'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default AdminNoticesPage;
