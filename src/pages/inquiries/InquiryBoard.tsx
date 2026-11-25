import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth, isAdminRole } from '../../auth';
import { getApiErrorMessage } from '../../api/apiClient';
import {
  deleteFaq,
  INQUIRIES_PER_PAGE,
  loadInquiryPage,
  postQuestion,
  saveAnswer,
  saveFaq,
  type BoardView,
  type Inquiry,
  type InquiryListing,
} from '../../api/inquiryApi';
import { formatKoDateKey } from '../../utils/date';
import SortHeaderButton from '../../components/admin/table/SortHeaderButton';
import InquiryAnswerEditor from './InquiryAnswerEditor';
import '../../styles/admin-participants.css';
import './inquiries.css';

type Editor = { type: 'ask' | 'faq' | 'answer'; item: Inquiry | null };
function InquiryEditor({
  editor,
  saved,
  close,
}: {
  editor: Editor;
  saved: (message: string) => void;
  close: () => void;
}) {
  const { type, item } = editor;
  const [title, setTitle] = useState(item?.title ?? '');
  const [content, setContent] = useState(item?.answer ?? '');
  const [visible, setVisible] = useState(item?.publicEntry ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (type === 'ask') await postQuestion(title, content, visible);
      else if (type === 'faq') await saveFaq(item, title, content, visible);
      else if (item) await saveAnswer(item, content);
      saved(
        type === 'ask'
          ? '문의를 접수했습니다. 내 문의에서 답변을 확인할 수 있습니다.'
          : '저장했습니다.',
      );
    } catch (err) {
      setError(getApiErrorMessage(err, '저장하지 못했습니다.'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form className="qa-editor" onSubmit={submit}>
      <h2>{type === 'ask' ? '문의 작성' : type === 'faq' ? '자주 묻는 질문 편집' : '문의 답변'}</h2>
      {type === 'answer' && item ? (
        <div className="qa-question">
          <strong>{item.title}</strong>
          <p>{item.content}</p>
        </div>
      ) : (
        <label>
          {type === 'faq' ? '질문' : '제목'}
          <input
            autoFocus
            required
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
      )}
      <label>
        {type === 'ask' ? '질문 내용' : '답변'}
        <textarea
          autoFocus={type === 'answer'}
          required
          maxLength={4000}
          rows={6}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </label>
      {type !== 'answer' && (
        <label className="qa-visibility">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
          {type === 'faq'
            ? '게시판에 공개'
            : '답변 후 질문과 답변 공개 (작성자 이름은 표시되지 않습니다)'}
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="qa-actions">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={close}>
          취소
        </button>
        <button
          className="btn btn-primary"
          disabled={busy || !content.trim() || (type !== 'answer' && !title.trim())}
        >
          {busy ? '저장 중…' : type === 'ask' ? '문의 등록' : '저장'}
        </button>
      </div>
    </form>
  );
}

const tabLabel: Record<BoardView, string> = {
  faq: '자주 묻는 질문',
  public: '공개 문의',
  mine: '내 문의',
  pending: '처리 전',
  all: '전체 문의',
};
export default function InquiryBoard({ admin = false }: { admin?: boolean }) {
  const { user, isInitializing } = useAuth();
  const [params, setParams] = useSearchParams();
  const tabs: BoardView[] = admin
    ? ['pending', 'all', 'faq']
    : ['faq', 'public', ...(user && !isAdminRole(user.role) ? ['mine' as const] : [])];
  const requested = params.get('view') as BoardView;
  const view = tabs.includes(requested) ? requested : tabs[0];
  const q = params.get('q') ?? '';
  const sortParam = params.get('sort');
  const oldestFirst =
    admin && (sortParam === 'oldest' || (sortParam !== 'newest' && view === 'pending'));
  const parsedPage = Number(params.get('page') ?? 0);
  const page = Number.isSafeInteger(parsedPage) && parsedPage >= 0 ? parsedPage : 0;
  const [editor, setEditor] = useState<Editor | null>(null);
  const [tick, setTick] = useState(0);
  const [status, setStatus] = useState('');
  const [removing, setRemoving] = useState(false);
  const [result, setResult] = useState<{ key: string; rows?: InquiryListing; error?: string }>();
  const key = JSON.stringify([admin, view, page, q, oldestFirst, tick, user?.userId]);
  useEffect(() => {
    let current = true;
    loadInquiryPage(view, admin, q, page, oldestFirst)
      .then((rows) => {
        if (!current) return;
        if (page > 0 && page >= rows.pages) {
          setParams(
            (previous) => {
              const next = new URLSearchParams(previous);
              if (rows.pages > 1) next.set('page', String(rows.pages - 1));
              else next.delete('page');
              return next;
            },
            { replace: true },
          );
          return;
        }
        setResult({ key, rows });
      })
      .catch((err) => {
        if (current)
          setResult({ key, error: getApiErrorMessage(err, '목록을 불러오지 못했습니다.') });
      });
    return () => {
      current = false;
    };
  }, [admin, view, q, page, oldestFirst, key, setParams]);
  const rows = result?.key === key ? result.rows : undefined;
  const error = result?.key === key ? result.error : undefined;
  function change(
    next: BoardView,
    index = 0,
    search = '',
    oldest = next === view ? oldestFirst : next === 'pending',
  ) {
    const values = new URLSearchParams({ view: next });
    if (admin && oldest !== (next === 'pending')) values.set('sort', oldest ? 'oldest' : 'newest');
    if (index) values.set('page', String(index));
    if (search) values.set('q', search);
    setParams(values);
    setEditor(null);
    setStatus('');
  }
  function saved(message: string) {
    if (editor?.type === 'ask') change('mine');
    else if (editor?.type === 'faq') change('faq');
    setEditor(null);
    setTick((t) => t + 1);
    setStatus(message);
  }
  async function remove(item: Inquiry) {
    if (removing || !window.confirm('자주 묻는 질문을 삭제할까요?')) return;
    setRemoving(true);
    try {
      await deleteFaq(item);
      change('faq', 0, q);
      setTick((t) => t + 1);
      setStatus('삭제했습니다.');
    } catch (err) {
      setStatus(getApiErrorMessage(err, '삭제하지 못했습니다.'));
    } finally {
      setRemoving(false);
    }
  }
  const Section = admin ? 'section' : 'main';
  return (
    <Section
      id={admin ? undefined : 'main'}
      className={admin ? 'admin-page qa-board' : 'wrap qa-board qa-public'}
    >
      <header className="qa-heading">
        <div>
          <h1>{admin ? '문의·FAQ 관리' : '문의 게시판'}</h1>
        </div>
        {admin
          ? view === 'faq' && (
              <button
                className="btn btn-primary"
                onClick={() => setEditor({ type: 'faq', item: null })}
              >
                자주 묻는 질문 작성
              </button>
            )
          : !isInitializing &&
            (user && !isAdminRole(user.role) ? (
              <button
                className="btn btn-primary"
                onClick={() => setEditor({ type: 'ask', item: null })}
              >
                문의 작성
              </button>
            ) : user ? (
              <Link to="/admin/inquiries" className="btn btn-secondary">
                문의 관리
              </Link>
            ) : (
              <Link
                to="/login"
                state={{ from: '/inquiries?view=mine' }}
                className="btn btn-secondary"
              >
                로그인 후 문의
              </Link>
            ))}
      </header>
      <nav className="qa-tabs" aria-label="문의 목록 선택">
        {tabs.map((t) => (
          <button key={t} aria-current={view === t ? 'page' : undefined} onClick={() => change(t)}>
            {tabLabel[t]}
          </button>
        ))}
      </nav>
      {status && <p role="status">{status}</p>}
      {editor?.type === 'answer' && editor.item ? (
        <InquiryAnswerEditor
          key={'answer' + editor.item.id}
          item={editor.item}
          saved={saved}
          close={() => setEditor(null)}
        />
      ) : editor ? (
        <InquiryEditor
          key={editor.type + String(editor.item?.id ?? '')}
          editor={editor}
          saved={saved}
          close={() => setEditor(null)}
        />
      ) : (
        <>
          <form
            key={view + q}
            className="qa-search"
            onSubmit={(e) => {
              e.preventDefault();
              change(view, 0, String(new FormData(e.currentTarget).get('q') ?? '').trim());
            }}
          >
            <input
              type="search"
              aria-label="질문 또는 답변 검색"
              name="q"
              maxLength={160}
              defaultValue={q}
              placeholder="질문 또는 답변 검색"
            />
            <button className="btn btn-secondary">검색</button>
            {q && (
              <button type="button" className="btn btn-secondary" onClick={() => change(view)}>
                초기화
              </button>
            )}
          </form>
          {error ? (
            <p role="alert" className="qa-load-error">
              {error}{' '}
              <button type="button" className="qa-retry" onClick={() => setTick((t) => t + 1)}>
                다시 불러오기
              </button>
            </p>
          ) : !rows ? (
            <p role="status">불러오는 중…</p>
          ) : (
            <>
              {admin ? (
                <div
                  className="roster-scroll"
                  role="region"
                  aria-label={tabLabel[view]}
                  tabIndex={0}
                >
                  <table className="roster-table qa-admin-table">
                    <caption className="sr-only">{tabLabel[view]}</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="qa-number">
                          순번
                        </th>
                        <th scope="col">{view === 'faq' ? '질문' : '문의 제목'}</th>
                        {view !== 'faq' && (
                          <th scope="col" className="qa-author">
                            작성자
                          </th>
                        )}
                        {/* 서버 목록은 페이지 단위라 등록일(최신순·오래된 순)만 전체 정렬할 수 있습니다. */}
                        <th
                          scope="col"
                          className="qa-date"
                          aria-sort={oldestFirst ? 'ascending' : 'descending'}
                        >
                          <SortHeaderButton
                            label="등록일"
                            direction={oldestFirst ? 'ascending' : 'descending'}
                            onSort={() => change(view, 0, q, !oldestFirst)}
                          />
                        </th>
                        <th scope="col" className="qa-visible">
                          공개 여부
                        </th>
                        {view !== 'faq' && (
                          <th scope="col" className="qa-state">
                            처리 상태
                          </th>
                        )}
                        <th scope="col" className="qa-manage">
                          관리
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.items.length === 0 && (
                        <tr>
                          <td className="roster-empty" colSpan={view === 'faq' ? 5 : 7}>
                            {q
                              ? '검색 결과가 없습니다.'
                              : view === 'pending'
                                ? '처리 전 문의가 없습니다.'
                                : '등록된 항목이 없습니다.'}
                          </td>
                        </tr>
                      )}
                      {rows.items.map((item, index) => (
                        <tr key={item.id}>
                          <td className="qa-number">{page * INQUIRIES_PER_PAGE + index + 1}</td>
                          <td title={item.title}>{item.title}</td>
                          {view !== 'faq' && (
                            <td title={item.authorName ?? ''}>{item.authorName || '—'}</td>
                          )}
                          <td>{formatKoDateKey(item.createdAt.slice(0, 10))}</td>
                          <td>
                            {item.publicEntry
                              ? item.kind === 'QUESTION' && !item.answer
                                ? '답변 후 공개'
                                : '공개'
                              : '비공개'}
                          </td>
                          {view !== 'faq' && (
                            <td className={item.answer ? undefined : 'qa-pending'}>
                              {item.answer ? '답변 완료' : '처리 전'}
                            </td>
                          )}
                          <td>
                            <button
                              type="button"
                              className="qa-row-action"
                              onClick={() =>
                                setEditor({ type: item.kind === 'FAQ' ? 'faq' : 'answer', item })
                              }
                            >
                              {item.kind === 'FAQ'
                                ? '수정'
                                : item.answer
                                  ? '답변 수정'
                                  : '답변 작성'}
                            </button>
                            {item.kind === 'FAQ' && (
                              <button
                                type="button"
                                className="qa-row-action"
                                disabled={removing}
                                onClick={() => void remove(item)}
                              >
                                삭제
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="qa-list">
                  {rows.items.length === 0 && (
                    <p>
                      {q
                        ? '검색 결과가 없습니다.'
                        : view === 'pending'
                          ? '답변을 기다리는 문의가 없습니다.'
                          : '등록된 항목이 없습니다.'}
                    </p>
                  )}
                  {rows.items.map((item) => (
                    <details key={item.id}>
                      <summary>
                        <strong>{item.title}</strong>
                        <span>
                          {item.kind === 'FAQ' ? '' : item.answer ? '답변 완료' : '답변 대기'}{' '}
                          {item.kind === 'QUESTION' && !item.publicEntry && ' · 비공개'}
                        </span>
                      </summary>
                      <div className="qa-detail">
                        {item.kind === 'QUESTION' && (
                          <>
                            <small>
                              {item.authorName && item.authorName + ' · '}
                              {formatKoDateKey(item.createdAt.slice(0, 10))}
                            </small>
                            <p>{item.content}</p>
                          </>
                        )}
                        {item.answer && (
                          <div className="qa-answer">
                            <strong>도서관 답변</strong>
                            <p>{item.answer}</p>
                          </div>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              )}
              {rows.pages > 1 && (
                <nav className="qa-pages" aria-label="목록 페이지">
                  <button
                    className="btn btn-secondary"
                    disabled={page <= 0}
                    onClick={() => change(view, page - 1, q)}
                  >
                    이전
                  </button>
                  <span>
                    {page + 1} / {rows.pages}
                  </span>
                  <button
                    className="btn btn-secondary"
                    disabled={page + 1 >= rows.pages}
                    onClick={() => change(view, page + 1, q)}
                  >
                    다음
                  </button>
                </nav>
              )}
            </>
          )}
        </>
      )}
    </Section>
  );
}
