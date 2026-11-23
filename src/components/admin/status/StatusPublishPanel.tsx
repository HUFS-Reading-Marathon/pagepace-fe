import { Link } from 'react-router-dom';
import { formatKoDateTime24 } from '../../../utils/date';
type Props = {
  lastCalculatedAt: string | null;
  isRefreshing: boolean;
  canRefresh: boolean;
  onRecalculate: () => void;
  publicVisible: boolean;
  canExport: boolean;
  onExport: () => void;
};
export default function StatusPublishPanel({
  lastCalculatedAt,
  isRefreshing,
  canRefresh,
  onRecalculate,
  publicVisible,
  canExport,
  onExport,
}: Props) {
  return (
    <div className="admin-status__actions" aria-label="현황 조회 및 내보내기">
      <p>
        {publicVisible ? '공개 중' : '비공개'}
        {lastCalculatedAt && <> · {formatKoDateTime24(lastCalculatedAt)} 조회</>}
      </p>
      <div>
        <Link to="/admin/event">공개 설정</Link>
        <button type="button" disabled={!canRefresh || isRefreshing} onClick={onRecalculate}>
          {isRefreshing ? '조회 중…' : '새로고침'}
        </button>
        <button type="button" disabled={!canExport} onClick={onExport}>
          CSV 다운로드
        </button>
      </div>
    </div>
  );
}
