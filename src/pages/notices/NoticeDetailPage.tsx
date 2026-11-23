import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '../../api/apiClient';
import { getNotice, type Notice } from '../../api/noticeApi';
import './notices.css';
import NoticeBody from '../../components/notices/NoticeBody';

function NoticeDetailPage() {
  const { id } = useParams();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      return;
    }

    getNotice(id)
      .then(setNotice)
      .catch((requestError: unknown) =>
        setError(getApiErrorMessage(requestError, '공지사항을 불러오지 못했습니다.')),
      );
  }, [id]);

  return (
    <main className="notice-detail-page">
      <Link to="/notices">← 공지사항으로 돌아가기</Link>
      {error ? (
        <div>{error}</div>
      ) : notice ? (
        <article>
          <header>
            <span>{notice.pinned ? '중요 공지' : '공지사항'}</span>
            <h1>{notice.title}</h1>
            <p>
              {notice.authorName} ·{' '}
              {new Date(notice.publishedAt ?? notice.updatedAt).toLocaleString('ko-KR')}
            </p>
          </header>
          <NoticeBody content={notice.content} color={notice.bodyColor} />
        </article>
      ) : (
        <div>공지사항을 불러오고 있습니다.</div>
      )}
    </main>
  );
}

export default NoticeDetailPage;
