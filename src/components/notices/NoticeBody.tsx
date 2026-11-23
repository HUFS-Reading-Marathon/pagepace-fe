import type { NoticeColor } from '../../api/noticeApi';
import './notice-body.css';

export default function NoticeBody({
  content,
  color,
}: {
  content: string;
  color?: NoticeColor | null;
}) {
  return (
    <div className="notice-body" data-color={color ?? 'DEFAULT'}>
      {content}
    </div>
  );
}
