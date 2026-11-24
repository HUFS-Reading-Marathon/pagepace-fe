import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { getApiErrorMessage } from '../../api/apiClient';
import { getNotices, type Notice } from '../../api/noticeApi';
import UserPageHeader from '../../components/layout/UserPageHeader';
import { formatKoDateKey } from '../../utils/date';
import {
  NOTICE_PAGE_SIZE,
  noticeDate,
  orderNotices,
  readNoticeBoardState,
  searchNotices,
  showsImportantBadge,
  writeNoticeBoardState,
  type NoticeLinkState,
} from './noticeBoard';
import '../main/MainPage.css';
import './notice-board.css';

/** 사용자 공지사항 게시판: 중요 공지 먼저, 제목 검색, 10건씩 쪽 나누기(검색어·쪽 번호는 주소에 유지) */
export default function NoticesPage() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { query, page } = readNoticeBoardState(params);
  const [items, setItems] = useState<Notice[]>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    getNotices()
      .then((rows) => {
        if (active) {
          setItems(orderNotices(rows));
          setError('');
        }
      })
      .catch((err) => {
        if (active) setError(getApiErrorMessage(err, '공지사항을 불러오지 못했습니다.'));
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const results = items ? searchNotices(items, query) : [];
  const pageCount = Math.max(1, Math.ceil(results.length / NOTICE_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const rows = results.slice(currentPage * NOTICE_PAGE_SIZE, (currentPage + 1) * NOTICE_PAGE_SIZE);
  const linkState: NoticeLinkState = { listSearch: location.search };

  const go = (next: { query?: string; page?: number }) =>
    setParams(writeNoticeBoardState({ query: next.query ?? query, page: next.page ?? 0 }));

  return (
    <main id="main" className="wrap user-page notice-board">
      <UserPageHeader
        title="공지사항"
        aside={
          items && (
            <p className="notice-board__count">
              {query ? '검색 결과 ' : '전체 '}
              <b>{results.length.toLocaleString('ko-KR')}</b>건
            </p>
          )
        }
      />

      {/* 뒤로·앞으로 가기로 검색어가 바뀌면 입력칸도 주소의 검색어로 다시 채웁니다(key). */}
      <form
        key={query}
        className="notice-board__search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          go({ query: String(new FormData(event.currentTarget).get('q') ?? ''), page: 0 });
        }}
      >
        <input
          type="search"
          name="q"
          aria-label="공지사항 제목 검색"
          placeholder="제목 검색"
          maxLength={100}
          defaultValue={query}
        />
        <button type="submit" className="btn btn-secondary">
          검색
        </button>
        {query && (
          <button
            type="button"
            className="notice-board__reset"
            onClick={() => go({ query: '', page: 0 })}
          >
            검색 초기화
          </button>
        )}
      </form>

      {error ? (
        <p className="notice-board__message" role="alert">
          {error}{' '}
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>
            다시 불러오기
          </button>
        </p>
      ) : !items ? (
        <p className="notice-board__message" role="status">
          공지사항을 불러오는 중입니다.
        </p>
      ) : results.length === 0 ? (
        <p className="notice-board__message" role="status">
          {query ? `“${query}”에 해당하는 공지사항이 없습니다.` : '등록된 공지사항이 없습니다.'}
        </p>
      ) : (
        <>
          <ul className="notice-board__list">
            {rows.map((notice) => (
              <li key={notice.noticeId} data-pinned={notice.pinned || undefined}>
                <Link to={`/notices/${notice.noticeId}`} state={linkState}>
                  <span className="notice-board__title">
                    {showsImportantBadge(notice) && (
                      <span className="notice-board__badge">중요</span>
                    )}
                    <span>{notice.title}</span>
                  </span>
                  <time dateTime={noticeDate(notice)}>
                    {formatKoDateKey(noticeDate(notice).slice(0, 10))}
                  </time>
                </Link>
              </li>
            ))}
          </ul>

          {pageCount > 1 && (
            <nav className="notice-board__pages" aria-label="공지사항 페이지">
              <button
                type="button"
                disabled={currentPage === 0}
                onClick={() => go({ page: currentPage - 1 })}
              >
                이전
              </button>
              {Array.from({ length: pageCount }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-current={index === currentPage ? 'page' : undefined}
                  onClick={() => go({ page: index })}
                >
                  {index + 1}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage >= pageCount - 1}
                onClick={() => go({ page: currentPage + 1 })}
              >
                다음
              </button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}
