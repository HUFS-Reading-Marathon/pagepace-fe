import { Link } from 'react-router-dom';
import type { Notice } from '../../api/noticeApi';
import type { FallbackNotice } from '../../pages/main/mainPageContent';

type MainNoticeListProps = {
  notices: Notice[];
  fallbackNotices: FallbackNotice[];
  maxCount: number;
};

type NoticeListItem = {
  key: string | number;
  to: string;
  pinned: boolean;
  title: string;
  dateTime: string;
  dateLabel: string;
};

function toNoticeListItem(notice: Notice): NoticeListItem {
  const publishedAt = notice.publishedAt ?? notice.updatedAt;

  return {
    key: notice.noticeId,
    to: `/notices/${notice.noticeId}`,
    pinned: notice.pinned,
    title: notice.title,
    dateTime: publishedAt,
    dateLabel: new Date(publishedAt).toLocaleDateString('ko-KR'),
  };
}

function toFallbackListItem(notice: FallbackNotice): NoticeListItem {
  return {
    key: notice.title,
    to: notice.href,
    pinned: false,
    title: notice.title,
    dateTime: notice.dateTime,
    dateLabel: notice.date,
  };
}

/** 메인 공지사항 섹션의 목록 (서버 공지가 없으면 fallback 안내 표시) */
function MainNoticeList({ notices, fallbackNotices, maxCount }: MainNoticeListProps) {
  const items = (
    notices.length > 0 ? notices.map(toNoticeListItem) : fallbackNotices.map(toFallbackListItem)
  ).slice(0, maxCount);

  return (
    <ul className="notice-list">
      {items.map((item) => (
        <li key={item.key}>
          <Link to={item.to}>
            <strong>
              {item.pinned && <span className="notice-badge">중요</span>}
              <span className="notice-title">{item.title}</span>
            </strong>
            <time dateTime={item.dateTime}>{item.dateLabel}</time>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default MainNoticeList;
