import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getApiErrorMessage } from '../../api/apiClient';
import {
  createAdminNotice,
  deleteAdminNotice,
  getAdminNotices,
  updateAdminNotice,
  type Notice,
  type NoticeRequest,
  type NoticeColor,
} from '../../api/noticeApi';
import { formatKoDateTime24 } from '../../utils/date';
import NoticeBody from '../../components/notices/NoticeBody';
import '../../styles/admin-notices.css';

const NEW_NOTICE: NoticeRequest = {
  title: '',
  content: '',
  bodyColor: 'DEFAULT',
  pinned: false,
  visible: false,
};

function NoticeEditor({
  notice,
  onSaved,
}: {
  notice?: Notice;
  onSaved: (visible: boolean) => void;
}) {
  const [form, setForm] = useState<NoticeRequest>(
    notice
      ? {
          ...NEW_NOTICE,
          title: notice.title,
          content: notice.content,
          bodyColor: notice.bodyColor ?? 'DEFAULT',
          pinned: notice.pinned,
          visible: notice.visible,
        }
      : NEW_NOTICE,
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function save(visible: boolean) {
    if (lock.current) return;
    if (!form.title.trim() || !form.content.trim()) {
      setError('제목과 내용을 입력해 주세요.');
      return;
    }
    if (
      visible &&
      !notice?.visible &&
      !window.confirm('공지사항을 게시할까요? 모든 방문자가 볼 수 있습니다.')
    )
      return;
    setBusy(true);
    lock.current = true;
    setError('');
    try {
      const request = { ...form, visible };
      if (notice) await updateAdminNotice(notice.noticeId, request);
      else await createAdminNotice(request);
      onSaved(visible);
    } catch (e) {
      setError(getApiErrorMessage(e, '공지사항을 저장하지 못했습니다.'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save(notice?.visible ?? false);
  };
  return (
    <form className="admin-notices__form" onSubmit={submit}>
      <label>
        제목
        <input
          required
          maxLength={200}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </label>
      <label>
        내용
        <textarea
          required
          rows={9}
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
        />
      </label>
      <label>
        본문 글자색
        <select
          value={form.bodyColor ?? 'DEFAULT'}
          onChange={(e) => setForm({ ...form, bodyColor: e.target.value as NoticeColor })}
        >
          <option value="DEFAULT">기본</option>
          <option value="NAVY">남색</option>
          <option value="RED">진한 빨강</option>
        </select>
      </label>
      <div className="admin-notices__checks">
        <label>
          <input
            type="checkbox"
            checked={form.pinned}
            onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
          />{' '}
          중요 공지
        </label>
      </div>
      {(form.title || form.content) && (
        <section className="admin-notices__preview" aria-label="사용자 화면 미리보기">
          <h2>미리보기</h2>
          <article>
            <strong>{form.title}</strong>
            <NoticeBody content={form.content} color={form.bodyColor} />
          </article>
        </section>
      )}
      {error && (
        <p role="alert" className="admin-notices__form-error">
          {error}
        </p>
      )}
      <div className="admin-notices__actions">
        <button
          type="button"
          className="admin-button"
          disabled={busy}
          onClick={() => void save(false)}
        >
          {notice?.visible ? '비공개로 전환' : '비공개로 저장'}
        </button>
        <button
          type="button"
          className="admin-button admin-button--primary"
          disabled={busy}
          onClick={() => void save(true)}
        >
          {notice?.visible ? '변경사항 게시' : '게시하기'}
        </button>
      </div>
    </form>
  );
}
type NoticeFilter = 'ALL' | 'visible' | 'hidden';
export default function AdminNoticesPage() {
  const [params, setParams] = useSearchParams();
  const edit = params.get('edit');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [version, setVersion] = useState(0);
  const [filter, setFilter] = useState<NoticeFilter>('ALL');
  const [query, setQuery] = useState('');
  useEffect(() => {
    let active = true;
    getAdminNotices()
      .then((all) => {
        if (active) {
          setNotices(all);
          setError('');
        }
      })
      .catch((e) => {
        if (active) setError(getApiErrorMessage(e, '공지를 불러오지 못했습니다.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [version]);
  function refresh() {
    setLoading(true);
    setVersion((v) => v + 1);
  }
  async function remove(item: Notice) {
    if (!window.confirm('“' + item.title + '” 공지를 삭제할까요?')) return;
    try {
      await deleteAdminNotice(item.noticeId);
      refresh();
      setFeedback('공지를 삭제했습니다.');
    } catch (e) {
      setError(getApiErrorMessage(e, '공지를 삭제하지 못했습니다.'));
    }
  }
  const editing = notices.find((n) => String(n.noticeId) === edit);
  const filtered = notices.filter(
    (n) =>
      (filter === 'ALL' || (filter === 'visible' ? n.visible : !n.visible)) &&
      (n.title + ' ' + n.content).toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <section className="admin-page admin-notices">
      <header className="admin-page__header admin-notices__header">
        <div>
          <h1>
            {edit === null ? '공지사항 관리' : edit === 'new' ? '공지사항 작성' : '공지사항 수정'}
          </h1>
        </div>
        <Link
          className="admin-button admin-button--primary"
          to={edit === null ? '?edit=new' : '/admin/notices'}
        >
          {edit === null ? '새 공지 작성' : '공지 목록으로'}
        </Link>
      </header>
      {error && (
        <p role="alert" className="admin-notices__error">
          {error}
        </p>
      )}
      {edit === null && feedback && (
        <p role="status" className="admin-feedback">
          {feedback}
        </p>
      )}
      <div className="admin-notices__layout">
        {edit !== null ? (
          edit === 'new' || editing ? (
            <NoticeEditor
              key={edit}
              notice={editing}
              onSaved={(visible) => {
                setParams({});
                refresh();
                setFeedback(visible ? '공지를 게시했습니다.' : '비공개로 저장했습니다.');
              }}
            />
          ) : (
            <p role="status">{loading ? '불러오는 중입니다.' : '찾을 수 없는 공지입니다.'}</p>
          )
        ) : (
          <section className="admin-notices__list">
            <header>
              <h2>등록된 공지</h2>
              <span>{filtered.length}건</span>
            </header>
            <div className="admin-notices__tools">
              <div className="admin-segmented" aria-label="게시 상태 필터">
                {(
                  [
                    ['ALL', '전체'],
                    ['visible', '게시 중'],
                    ['hidden', '비공개'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    type="button"
                    key={key}
                    aria-pressed={filter === key}
                    onClick={() => setFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                type="search"
                aria-label="공지 검색"
                placeholder="제목 또는 내용 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {loading ? (
              <p className="admin-notices__empty">불러오는 중입니다.</p>
            ) : filtered.length ? (
              filtered.map((n) => (
                <article key={n.noticeId} className={n.visible ? '' : 'is-hidden'}>
                  <div>
                    <span>{n.pinned ? '중요' : '일반'}</span>
                    <strong>{n.title}</strong>
                    <small>
                      <em className={n.visible ? 'is-visible' : undefined}>
                        {n.visible ? '게시 중' : '비공개'}
                      </em>
                      {' · '}
                      {formatKoDateTime24(n.updatedAt)} · {n.authorName}
                    </small>
                  </div>
                  <div>
                    {n.visible && <Link to={'/notices/' + n.noticeId}>게시 화면</Link>}
                    <Link to={'?edit=' + n.noticeId}>수정</Link>
                    <button type="button" onClick={() => void remove(n)}>
                      삭제
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="admin-notices__empty">
                {notices.length ? '조건에 맞는 공지가 없습니다.' : '등록된 공지가 없습니다.'}
              </p>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
