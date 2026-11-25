import { lazy, Suspense } from 'react';
import type { NoticeColor } from '../../api/noticeApi';
import { getNoticeContentFormat, stripNoticeMarker } from '../../utils/noticeContent';
import './notice-body.css';

// Markdown 해석기는 Markdown 공지를 열 때만 불러옵니다.
const NoticeMarkdownContent = lazy(() => import('./NoticeMarkdownContent'));

/**
 * 공지 본문. 새 편집기로 쓴 Markdown 공지는 편집기와 같은 해석으로 서식을 보여 주고,
 * 예전 일반 텍스트 공지는 입력한 그대로(줄바꿈·공백 유지) 보여 줍니다.
 */
export default function NoticeBody({
  content,
  color,
}: {
  content: string;
  color?: NoticeColor | null;
}) {
  if (getNoticeContentFormat(content) === 'plain') {
    return (
      <div className="notice-body" data-color={color ?? 'DEFAULT'}>
        {content}
      </div>
    );
  }

  return (
    <div className="notice-body notice-body--rich" data-color={color ?? 'DEFAULT'}>
      <Suspense fallback={null}>
        <NoticeMarkdownContent markdown={stripNoticeMarker(content)} />
      </Suspense>
    </div>
  );
}
