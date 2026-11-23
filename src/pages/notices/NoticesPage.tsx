import { useEffect, useState } from 'react';
import { getNotices, type Notice } from '../../api/noticeApi';
import { getApiErrorMessage } from '../../api/apiClient';
import MainNoticeList from '../../components/main/MainNoticeList';
import '../main/MainPage.css';

export default function NoticesPage() {
  const [items, setItems] = useState<Notice[]>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    getNotices()
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch((err) => {
        if (active) setError(getApiErrorMessage(err, '공지사항을 불러오지 못했습니다.'));
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <main id="main" className="wrap qa-public">
      <h1>공지사항</h1>
      {error ? (
        <p role="alert">{error}</p>
      ) : !items ? (
        <p role="status">불러오는 중…</p>
      ) : !items.length ? (
        <p>등록된 공지사항이 없습니다.</p>
      ) : (
        <MainNoticeList notices={items} fallbackNotices={[]} maxCount={items.length} />
      )}
    </main>
  );
}
