import ContentSkeleton from '../../components/layout/ContentSkeleton';
import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
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
import { stripNoticeMarker } from '../../utils/noticeContent';
import NoticeBody from '../../components/notices/NoticeBody';
import SlidingSegmented from '../../components/admin/common/SlidingSegmented';
import type { NoticeEditorChange } from '../../components/admin/notices/NoticeRichEditor';
import '../../pages/notices/notices.css';
import '../../styles/admin-notices.css';

// 편집기(Tiptap)는 작성·수정 화면에서만 불러옵니다.
const NoticeRichEditor = lazy(() => import('../../components/admin/notices/NoticeRichEditor'));

const NEW_NOTICE: NoticeRequest = {
  title: '',
  content: '',
  bodyColor: 'DEFAULT',
  pinned: false,
  visible: false,
};

const LEAVE_MESSAGE = '저장하지 않은 변경사항이 있습니다. 이 화면을 나갈까요?';

/**
 * 저장하지 않은 변경이 있으면 새로고침·창 닫기와 화면 안 링크 이동 전에 확인합니다.
 * (BrowserRouter라 라우터 차단 기능을 쓸 수 없어, 링크 클릭을 캡처 단계에서 확인합니다.)
 */
function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!anchor || anchor.getAttribute('target') === '_blank') return;
      if (anchor.closest('.notice-editor__surface')) return;
      if (!window.confirm(LEAVE_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [active]);
}

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
  const [bodyEmpty, setBodyEmpty] = useState(!notice?.content.trim());
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState<boolean | null>(null);
  const busy = publishing !== null;
  const lock = useRef(false);
  useLeaveGuard(dirty && !busy);

  const update = (patch: Partial<NoticeRequest>) => {
    setForm((current) => ({ ...current, ...patch }));
    setDirty(true);
  };
  const handleBodyChange = ({ content, isEmpty }: NoticeEditorChange) => {
    setForm((current) => ({ ...current, content }));
    setBodyEmpty(isEmpty);
    setDirty(true);
  };

  async function save(visible: boolean) {
    if (lock.current) return;
    if (!form.title.trim() || bodyEmpty) {
      setError('제목과 내용을 입력해 주세요.');
      return;
    }
    if (
      visible &&
      !notice?.visible &&
      !window.confirm('공지사항을 게시할까요? 모든 방문자가 볼 수 있습니다.')
    )
      return;
    setPublishing(visible);
    lock.current = true;
    setError('');
    try {
      const request = { ...form, visible };
      if (notice) await updateAdminNotice(notice.noticeId, request);
      else await createAdminNotice(request);
      setDirty(false);
      onSaved(visible);
    } catch (e) {
      setError(getApiErrorMessage(e, '공지사항을 저장하지 못했습니다.'));
    } finally {
      lock.current = false;
      setPublishing(null);
    }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save(notice?.visible ?? false);
  };
  const color: NoticeColor = form.bodyColor ?? 'DEFAULT';

  return (
    <form className="admin-notice-editor" onSubmit={submit}>
      <div className="admin-notice-editor__head">
        <label className="admin-notice-editor__title">
          <span>공지 제목</span>
          <input
            required
            maxLength={200}
            placeholder="제목을 입력하세요"
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
          />
        </label>
        <div className="admin-notice-editor__options">
          <label className="admin-notice-editor__check">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => update({ pinned: e.target.checked })}
            />
            중요 공지
          </label>
          <label className="admin-notice-editor__color">
            <span>본문 글자색</span>
            <select
              value={color}
              onChange={(e) => update({ bodyColor: e.target.value as NoticeColor })}
            >
              <option value="DEFAULT">기본</option>
              <option value="NAVY">남색</option>
              <option value="RED">진한 빨강</option>
            </select>
          </label>
          <div className="admin-segmented" aria-label="편집·미리보기 전환">
            <button type="button" aria-pressed={mode === 'write'} onClick={() => setMode('write')}>
              작성
            </button>
            <button
              type="button"
              aria-pressed={mode === 'preview'}
              onClick={() => setMode('preview')}
            >
              미리보기
            </button>
          </div>
        </div>
      </div>

      <Suspense
        fallback={<p className="admin-notice-editor__loading">편집기를 불러오는 중입니다.</p>}
      >
        {/* 미리보기 중에도 편집기를 그대로 두어 작성 중인 내용과 커서 위치를 잃지 않습니다. */}
        <NoticeRichEditor
          initialContent={notice?.content ?? ''}
          color={color}
          hidden={mode === 'preview'}
          onChange={handleBodyChange}
        />
      </Suspense>

      {mode === 'preview' && (
        <div
          className="notice-detail-page admin-notice-editor__preview"
          aria-label="게시 화면 미리보기"
        >
          <article>
            <header>
              <span>{form.pinned ? '중요 공지' : '공지사항'}</span>
              <h1>{form.title || '제목 없음'}</h1>
              <p>{notice?.authorName ?? '작성자'} · 게시 전 미리보기</p>
            </header>
            <NoticeBody content={form.content} color={color} />
          </article>
        </div>
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
          aria-busy={publishing === false}
          disabled={busy}
          onClick={() => void save(false)}
        >
          {publishing === false ? '저장 중…' : notice?.visible ? '비공개로 전환' : '비공개로 저장'}
        </button>
        <button
          type="button"
          className="admin-button admin-button--primary"
          aria-busy={publishing === true}
          disabled={busy}
          onClick={() => void save(true)}
        >
          {publishing === true ? '게시 중…' : notice?.visible ? '변경사항 게시' : '게시하기'}
        </button>
      </div>
    </form>
  );
}
type NoticeFilter = 'ALL' | 'visible' | 'hidden';

const FILTER_OPTIONS: ReadonlyArray<{ value: NoticeFilter; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'visible', label: '게시 중' },
  { value: 'hidden', label: '비공개' },
];
export default function AdminNoticesPage() {
  const [params, setParams] = useSearchParams();
  const edit = params.get('edit');
  const [deleting, setDeleting] = useState<number | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
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
          setHasLoaded(true);
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
    if (loading || deleting !== null || !window.confirm('“' + item.title + '” 공지를 삭제할까요?'))
      return;
    try {
      setDeleting(item.noticeId);
      await deleteAdminNotice(item.noticeId);
      refresh();
      setFeedback('공지를 삭제했습니다.');
    } catch (e) {
      setError(getApiErrorMessage(e, '공지를 삭제하지 못했습니다.'));
    } finally {
      setDeleting(null);
    }
  }
  const editing = notices.find((n) => String(n.noticeId) === edit);
  const filtered = notices.filter(
    (n) =>
      (filter === 'ALL' || (filter === 'visible' ? n.visible : !n.visible)) &&
      (n.title + ' ' + stripNoticeMarker(n.content))
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
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
          {edit === null ? (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path
                  d="M7 2v10M2 7h10"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.8"
                />
              </svg>
              새 공지 작성
            </>
          ) : (
            '공지 목록으로'
          )}
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
          ) : loading ? (
            <ContentSkeleton variant="form" label="공지를 불러오는 중입니다." />
          ) : (
            <p role="status">찾을 수 없는 공지입니다.</p>
          )
        ) : (
          <section className="admin-notices__list" aria-busy={loading}>
            <header>
              <h2>등록된 공지</h2>
              <span>{filtered.length}건</span>
            </header>
            <div className="admin-notices__tools">
              <SlidingSegmented
                label="게시 상태 필터"
                options={FILTER_OPTIONS}
                value={filter}
                onChange={setFilter}
              />
              <label className="admin-notices__search">
                <svg
                  viewBox="0 0 20 20"
                  width="16"
                  height="16"
                  aria-hidden="true"
                  focusable="false"
                >
                  <circle cx="9" cy="9" r="5.5" />
                  <path d="m13.2 13.2 3.8 3.8" />
                </svg>
                <input
                  type="search"
                  aria-label="공지 검색"
                  placeholder="제목 또는 내용 검색"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            {loading && !hasLoaded ? (
              <ContentSkeleton variant="list" label="공지를 불러오는 중입니다." />
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
                    <button
                      type="button"
                      disabled={loading || deleting !== null}
                      aria-busy={deleting === n.noticeId}
                      onClick={() => void remove(n)}
                    >
                      {deleting === n.noticeId ? '삭제 중…' : '삭제'}
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
