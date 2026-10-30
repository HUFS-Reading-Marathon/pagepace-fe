import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '../../api/apiClient';
import {
  createAdminNotice,
  deleteAdminNotice,
  getAdminNotices,
  updateAdminNotice,
  type Notice,
  type NoticeRequest,
} from '../../api/noticeApi';
import { formatKoDateTime24 } from '../../utils/date';
import '../../styles/admin-notices.css';

type NoticeTab = 'ALL' | 'visible' | 'hidden';

/** 새 공지는 비공개 초안으로 시작합니다. 게시는 '게시하기'를 눌러 확인한 뒤에만 이뤄집니다. */
const EMPTY_FORM: NoticeRequest = {
  title: '',
  content: '',
  pinned: false,
  visible: false,
};

const NOTICE_TABS: ReadonlyArray<{ value: NoticeTab; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'visible', label: '게시 중' },
  { value: 'hidden', label: '비공개' },
];

function toNoticeForm(notice: Notice): NoticeRequest {
  return {
    title: notice.title,
    content: notice.content,
    pinned: notice.pinned,
    visible: notice.visible,
  };
}

function getNoticeDate(notice: Notice) {
  return formatKoDateTime24(notice.publishedAt ?? notice.updatedAt);
}

function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [form, setForm] = useState<NoticeRequest>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [tab, setTab] = useState<NoticeTab>('ALL');
  const [keyword, setKeyword] = useState('');
  const [isConfirmingPublish, setIsConfirmingPublish] = useState(false);

  const load = () =>
    getAdminNotices()
      .then((nextNotices) => {
        setNotices(nextNotices);
        setError('');
      })
      .catch((requestError: unknown) =>
        setError(getApiErrorMessage(requestError, '공지사항을 불러오지 못했습니다.')),
      )
      .finally(() => setLoading(false));

  useEffect(() => {
    void load();
  }, []);

  const counts = {
    ALL: notices.length,
    visible: notices.filter((notice) => notice.visible).length,
    hidden: notices.filter((notice) => !notice.visible).length,
  };

  const visibleNotices = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return notices.filter((notice) => {
      const matchesTab = tab === 'ALL' || (tab === 'visible' ? notice.visible : !notice.visible);
      const matchesKeyword =
        !normalizedKeyword ||
        [notice.title, notice.content].some((value) =>
          value.toLowerCase().includes(normalizedKeyword),
        );

      return matchesTab && matchesKeyword;
    });
  }, [keyword, notices, tab]);

  const start = (notice?: Notice) => {
    setEditing(notice ?? null);
    setForm(notice ? toNoticeForm(notice) : EMPTY_FORM);
    setFormError('');
    setIsConfirmingPublish(false);
  };

  /** 공개 여부를 명시적으로 정해 저장합니다. 서버 저장이 성공한 뒤에만 목록과 폼을 갱신합니다. */
  const save = async (visible: boolean) => {
    if (!form.title.trim() || !form.content.trim()) {
      setFormError('제목과 내용을 모두 입력해 주세요.');
      setIsConfirmingPublish(false);
      return;
    }

    setSaving(true);
    setFormError('');
    setFeedback('');

    try {
      const request = { ...form, visible };

      if (editing) {
        await updateAdminNotice(editing.noticeId, request);
      } else {
        await createAdminNotice(request);
      }

      start();
      await load();
      setFeedback(
        visible
          ? '공지를 게시했습니다. 사용자 홈 공지사항에 표시됩니다.'
          : '공지를 비공개로 저장했습니다. 사용자에게는 보이지 않습니다.',
      );
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError, '공지사항을 저장하지 못했습니다.'));
    } finally {
      setSaving(false);
      setIsConfirmingPublish(false);
    }
  };

  // Enter 등으로 폼이 제출되면 현재 공개 상태를 유지해 저장합니다(실수로 게시·비공개 전환 방지).
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void save(editing?.visible ?? false);
  };

  const remove = async (notice: Notice) => {
    if (!confirm(`“${notice.title}” 공지를 삭제할까요? 삭제한 공지는 복구할 수 없습니다.`)) {
      return;
    }

    setFeedback('');

    try {
      await deleteAdminNotice(notice.noticeId);

      if (editing?.noticeId === notice.noticeId) {
        start();
      }

      await load();
      setFeedback('공지를 삭제했습니다.');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '공지사항을 삭제하지 못했습니다.'));
    }
  };

  const statusLabel = editing ? (editing.visible ? '게시 중' : '비공개') : '새 공지 · 저장 전';

  return (
    <section className="admin-page admin-notices">
      <header className="admin-page__header admin-notices__header">
        <div>
          <h1>공지사항 관리</h1>
          <p>사용자 홈 공지사항에 표시할 운영 공지를 작성하고 게시 상태를 관리합니다.</p>
        </div>
        <button
          type="button"
          className="admin-button admin-button--primary"
          onClick={() => start()}
        >
          + 새 공지 작성
        </button>
      </header>
      {error && (
        <p className="admin-notices__error" role="alert">
          {error}
        </p>
      )}
      <p className="admin-feedback" role="status" aria-live="polite">
        {feedback}
      </p>
      <div className="admin-notices__layout">
        <section className="admin-notices__list" aria-labelledby="noticeListTitle">
          <header>
            <h2 id="noticeListTitle">등록된 공지</h2>
            <span>{visibleNotices.length}건</span>
          </header>
          <div className="admin-notices__tools">
            <div className="admin-segmented" aria-label="게시 상태 필터">
              {NOTICE_TABS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={tab === item.value}
                  onClick={() => setTab(item.value)}
                >
                  {item.label} <b>{counts[item.value]}</b>
                </button>
              ))}
            </div>
            <input
              type="search"
              value={keyword}
              aria-label="공지 검색"
              placeholder="제목 또는 내용 검색"
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>
          {loading ? (
            <p className="admin-notices__empty">불러오는 중입니다.</p>
          ) : visibleNotices.length === 0 ? (
            <p className="admin-notices__empty">
              {notices.length === 0
                ? '등록된 공지가 없습니다. 오른쪽에서 첫 공지를 작성해 주세요.'
                : '조건에 맞는 공지가 없습니다.'}
            </p>
          ) : (
            visibleNotices.map((notice) => (
              <article
                key={notice.noticeId}
                className={[
                  !notice.visible ? 'is-hidden' : '',
                  editing?.noticeId === notice.noticeId ? 'is-editing' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div>
                  <span>{notice.pinned ? '중요' : '일반'}</span>
                  <strong>{notice.title}</strong>
                  <small>
                    <em className={notice.visible ? 'is-visible' : undefined}>
                      {notice.visible ? '게시 중' : '비공개'}
                    </em>{' '}
                    · {getNoticeDate(notice)} · {notice.authorName}
                  </small>
                </div>
                <div>
                  <button type="button" onClick={() => start(notice)}>
                    수정
                  </button>
                  <button type="button" onClick={() => void remove(notice)}>
                    삭제
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
        <form className="admin-notices__form" onSubmit={handleSubmit} noValidate>
          <div className="admin-notices__form-head">
            <div>
              <span>{editing ? '공지 수정' : '새 공지'}</span>
              <h2>{editing?.title || '공지사항 작성'}</h2>
            </div>
            <em
              className={['admin-notices__state', editing?.visible ? 'is-visible' : '']
                .filter(Boolean)
                .join(' ')}
            >
              {statusLabel}
            </em>
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
              rows={9}
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
              중요 공지 <small>목록에서 강조되어 표시됩니다.</small>
            </label>
          </div>

          {(form.title.trim() || form.content.trim()) && (
            <div className="admin-notices__preview" aria-label="사용자 화면 미리보기">
              <span>미리보기</span>
              <div>
                <em>{form.pinned ? '중요' : '공지'}</em>
                <strong>{form.title || '제목 없음'}</strong>
                <p>{form.content}</p>
              </div>
            </div>
          )}

          <p className="admin-notices__target">
            게시 위치: 사용자 홈 공지사항 · 공개 대상: 로그인하지 않은 방문자를 포함한 모든 사용자
          </p>

          {formError && (
            <p className="admin-notices__form-error" role="alert">
              {formError}
            </p>
          )}

          {isConfirmingPublish ? (
            <div className="admin-notices__confirm" role="group" aria-label="게시 확인">
              <p>저장 즉시 사용자 홈 공지사항에 공개됩니다. 게시할까요?</p>
              <div className="admin-notices__actions">
                <button
                  type="button"
                  className="admin-button"
                  disabled={saving}
                  onClick={() => setIsConfirmingPublish(false)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="admin-button admin-button--primary"
                  disabled={saving}
                  onClick={() => void save(true)}
                >
                  {saving ? '저장 중…' : '게시 확정'}
                </button>
              </div>
            </div>
          ) : (
            <div className="admin-notices__actions">
              <button type="button" className="admin-button" onClick={() => start()}>
                {editing ? '새 공지로 전환' : '입력 지우기'}
              </button>
              <button
                type="button"
                className="admin-button"
                disabled={saving}
                onClick={() => void save(false)}
              >
                {saving ? '저장 중…' : editing?.visible ? '비공개로 전환' : '비공개로 저장'}
              </button>
              <button
                type="button"
                className="admin-button admin-button--primary"
                disabled={saving}
                onClick={() => setIsConfirmingPublish(true)}
              >
                {editing?.visible ? '변경사항 게시' : '게시하기'}
              </button>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}

export default AdminNoticesPage;
