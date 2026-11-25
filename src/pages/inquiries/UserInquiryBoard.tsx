import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { isAdminRole, useAuth } from '../../auth';
import { getApiErrorMessage } from '../../api/apiClient';
import { loadInquiries, type Inquiry, type InquiryListing } from '../../api/inquiryApi';
import UserPageHeader from '../../components/layout/UserPageHeader';
import { formatKoDateKey } from '../../utils/date';
import {
  ANSWER_LABELS,
  USER_VIEW_LABELS,
  answerState,
  readUserInquiryState,
  userInquiryViews,
  visibilityLabel,
  writeUserInquiryState,
  type UserInquiryState,
  type UserInquiryView,
} from './inquiryBoardState';
import '../main/MainPage.css';
import './user-inquiries.css';

/** 문의 작성 후 게시판으로 돌아올 때 넘기는 안내 문구 */
export type InquiryBoardLinkState = { notice?: string } | null;

const SEARCH_PLACEHOLDER: Record<UserInquiryView, string> = {
  faq: '질문 또는 답변 검색',
  public: '제목 또는 내용 검색',
  mine: '제목 또는 내용 검색',
};

const EMPTY_MESSAGE: Record<UserInquiryView, string> = {
  faq: '등록된 자주 묻는 질문이 없습니다.',
  public: '공개된 문의가 없습니다.',
  mine: '작성한 문의가 없습니다.',
};

function Chevron() {
  return (
    <svg className="inquiry-board__chevron" viewBox="0 0 16 16" aria-hidden="true">
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

/** 펼침 영역: 높이를 부드럽게 바꾸고, 접혀 있을 때는 inert로 초점·읽기 대상에서 뺍니다. */
function Panel({ id, open, children }: { id: string; open: boolean; children: ReactNode }) {
  return (
    <div id={id} className="inquiry-board__panel" data-open={open || undefined} inert={!open}>
      <div className="inquiry-board__panel-inner">{children}</div>
    </div>
  );
}

function FaqItem({ item }: { item: Inquiry }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <li className="inquiry-board__item">
      <h3 className="inquiry-board__item-heading">
        <button
          type="button"
          className="inquiry-board__toggle inquiry-board__toggle--faq"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="inquiry-board__faq-mark" aria-hidden="true">
            Q
          </span>
          <span className="inquiry-board__title">{item.title}</span>
          <Chevron />
        </button>
      </h3>
      <Panel id={panelId} open={open}>
        <div className="inquiry-board__answer inquiry-board__answer--faq">
          <p>{item.answer}</p>
        </div>
      </Panel>
    </li>
  );
}

function QuestionItem({ item, mine }: { item: Inquiry; mine: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const state = answerState(item);
  const date = formatKoDateKey(item.createdAt.slice(0, 10));
  return (
    <li className="inquiry-board__item">
      <h3 className="inquiry-board__item-heading">
        <button
          type="button"
          className="inquiry-board__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="inquiry-board__summary">
            <span className="inquiry-board__title">{item.title}</span>
            <span className="inquiry-board__meta">
              <time dateTime={item.createdAt}>{date}</time>
              {mine && <span>{visibilityLabel(item)}</span>}
            </span>
          </span>
          <span className={`inquiry-board__state is-${state}`}>{ANSWER_LABELS[state]}</span>
          <Chevron />
        </button>
      </h3>
      <Panel id={panelId} open={open}>
        <section className="inquiry-board__question" aria-label="문의 내용">
          <h4>문의 내용</h4>
          <p>{item.content}</p>
        </section>
        {state === 'answered' ? (
          <section className="inquiry-board__answer" aria-label="도서관 답변">
            <h4>
              도서관 답변
              {item.answeredAt && (
                <time dateTime={item.answeredAt}>
                  {formatKoDateKey(item.answeredAt.slice(0, 10))}
                </time>
              )}
            </h4>
            <p>{item.answer}</p>
          </section>
        ) : (
          <p className="inquiry-board__waiting">아직 답변이 등록되지 않았습니다.</p>
        )}
      </Panel>
    </li>
  );
}

export default function UserInquiryBoard() {
  const { user, isInitializing } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const isAdmin = !!user && isAdminRole(user.role);
  const canAsk = !!user && !isAdmin;
  const views = userInquiryViews(canAsk);
  const { view, query, page } = readUserInquiryState(params, views);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; rows?: InquiryListing; error?: string }>();
  const notice = (location.state as InquiryBoardLinkState)?.notice;

  // 로그인 확인 중에는 내 문의 탭 여부가 정해지지 않으므로 기다립니다.
  const ready = !isInitializing;
  const key = JSON.stringify([view, query, page, attempt, user?.userId ?? null]);
  useEffect(() => {
    if (!ready) return;
    let current = true;
    loadInquiries(view, false, query, page)
      .then((rows) => {
        if (!current) return;
        // 지워진 글 등으로 쪽 수가 줄었으면 마지막 쪽으로 옮깁니다(기존 게시판과 같음).
        if (page > 0 && page >= rows.pages) {
          setParams(writeUserInquiryState({ view, query, page: Math.max(0, rows.pages - 1) }), {
            replace: true,
          });
          return;
        }
        setResult({ key, rows });
      })
      .catch((error) => {
        if (current)
          setResult({ key, error: getApiErrorMessage(error, '목록을 불러오지 못했습니다.') });
      });
    return () => {
      current = false;
    };
  }, [ready, view, query, page, key, setParams]);

  const rows = result?.key === key ? result.rows : undefined;
  const error = result?.key === key ? result.error : undefined;

  const go = (next: Partial<UserInquiryState>) => {
    // 주소만 바꾸고 이동 상태는 넘기지 않아, 탭이나 검색을 바꾸면 작성 완료 안내가 사라집니다.
    const search = writeUserInquiryState({ view, query, page: 0, ...next }).toString();
    navigate({ search: search ? `?${search}` : '' });
  };

  const writeAction = isInitializing ? null : isAdmin ? (
    <Link to="/admin/inquiries" className="btn btn-secondary inquiry-board__action">
      문의 관리
    </Link>
  ) : (
    // 비로그인이면 작성 화면의 로그인 확인이 로그인 페이지로 보내고, 로그인 뒤 작성 화면으로 돌아옵니다.
    <Link to="/inquiries/new" className="btn btn-primary inquiry-board__action">
      문의 작성
    </Link>
  );

  return (
    <main id="main" className="wrap user-page inquiry-board">
      <UserPageHeader title="문의 게시판" aside={writeAction} />

      <nav className="inquiry-board__tabs" aria-label="문의 목록 선택">
        {views.map((item) => (
          <button
            key={item}
            type="button"
            aria-current={view === item ? 'page' : undefined}
            onClick={() => go({ view: item, query: '' })}
          >
            {USER_VIEW_LABELS[item]}
          </button>
        ))}
      </nav>

      {notice && view === 'mine' && (
        <p className="inquiry-board__notice" role="status">
          {notice}
        </p>
      )}

      <form
        key={view + query}
        className="inquiry-board__search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          go({ query: String(new FormData(event.currentTarget).get('q') ?? '') });
        }}
      >
        <input
          type="search"
          name="q"
          aria-label={SEARCH_PLACEHOLDER[view]}
          placeholder={SEARCH_PLACEHOLDER[view]}
          maxLength={160}
          defaultValue={query}
        />
        <button type="submit" className="btn btn-secondary">
          검색
        </button>
        {query && (
          <button type="button" className="inquiry-board__reset" onClick={() => go({ query: '' })}>
            검색 초기화
          </button>
        )}
      </form>

      <div aria-live="polite" aria-busy={!rows && !error}>
        {error ? (
          <p className="inquiry-board__message" role="alert">
            {error}{' '}
            <button type="button" onClick={() => setAttempt((value) => value + 1)}>
              다시 불러오기
            </button>
          </p>
        ) : !rows ? (
          <p className="inquiry-board__message">목록을 불러오는 중입니다.</p>
        ) : rows.items.length === 0 ? (
          <p className="inquiry-board__message">
            {query ? `“${query}”에 해당하는 항목이 없습니다.` : EMPTY_MESSAGE[view]}
          </p>
        ) : (
          <>
            {view !== 'faq' && (
              <div className="inquiry-board__columns" aria-hidden="true">
                <span>제목</span>
                <span>답변 상태</span>
              </div>
            )}
            <ul
              className={`inquiry-board__list${view === 'faq' ? ' is-faq' : ''}`}
              aria-label={USER_VIEW_LABELS[view]}
            >
              {rows.items.map((item) =>
                view === 'faq' ? (
                  <FaqItem key={item.id} item={item} />
                ) : (
                  <QuestionItem key={item.id} item={item} mine={view === 'mine'} />
                ),
              )}
            </ul>
            {rows.pages > 1 && (
              <nav className="inquiry-board__pages" aria-label={`${USER_VIEW_LABELS[view]} 페이지`}>
                <button type="button" disabled={page === 0} onClick={() => go({ page: page - 1 })}>
                  이전
                </button>
                {Array.from({ length: rows.pages }, (_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-current={index === page ? 'page' : undefined}
                    onClick={() => go({ page: index })}
                  >
                    {index + 1}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={page >= rows.pages - 1}
                  onClick={() => go({ page: page + 1 })}
                >
                  다음
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  );
}
