import ContentSkeleton from '../../components/layout/ContentSkeleton';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ApiError, getApiErrorMessage } from '../../api/apiClient';
import { getNotice, type Notice } from '../../api/noticeApi';
import { formatKoDateTime24 } from '../../utils/date';
import './notices.css';
import NoticeBody from '../../components/notices/NoticeBody';
import { noticeDate, type NoticeLinkState } from './noticeBoard';
import './notice-board.css';

function NoticeDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  // 목록에서 들어왔으면 그때의 검색어·쪽 번호로, 주소로 바로 들어왔으면 첫 쪽으로 돌아갑니다.
  const listSearch = (location.state as NoticeLinkState)?.listSearch ?? '';
  const [result, setResult] = useState<{
    id: string;
    notice?: Notice;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    getNotice(id)
      .then((notice) => {
        if (active) setResult({ id, notice });
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        // 없는 공지와 비공개 공지는 서버가 같은 404로 답합니다.
        const missing =
          !/^\d+$/.test(id) || (requestError instanceof ApiError && requestError.status === 404);
        setResult({
          id,
          error: missing
            ? '공지사항을 찾을 수 없습니다. 삭제되었거나 공개되지 않은 공지입니다.'
            : getApiErrorMessage(requestError, '공지사항을 불러오지 못했습니다.'),
        });
      });
    return () => {
      active = false;
    };
  }, [id]);

  const current = result?.id === id ? result : null;
  const notice = current?.notice;

  return (
    <main id="main" className="notice-detail-page">
      <Link to={`/notices${listSearch}`}>← 공지사항 목록</Link>
      {current?.error ? (
        <p className="notice-detail-page__message" role="alert">
          {current.error}
        </p>
      ) : notice ? (
        <article>
          <header>
            <span>{notice.pinned ? '중요 공지' : '공지사항'}</span>
            <h1>{notice.title}</h1>
            <p>
              {notice.authorName} ·{' '}
              <time dateTime={noticeDate(notice)}>{formatKoDateTime24(noticeDate(notice))}</time>
            </p>
          </header>
          <NoticeBody content={notice.content} color={notice.bodyColor} />
        </article>
      ) : (
        <ContentSkeleton variant="detail" label="공지사항을 불러오고 있습니다." />
      )}
    </main>
  );
}

export default NoticeDetailPage;
