import './detail-nav.css';

type Props = {
  /** 이전·다음 버튼 이름 (예: "일지", "서평") */
  noun: string;
  position: { index: number; total: number } | null;
  busy?: boolean;
  onBack: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
};

/** 관리자 상세 화면 상단: 목록으로, 현재 위치, 이전·다음 이동 */
export default function DetailNavBar({
  noun,
  position,
  busy = false,
  onBack,
  onPrevious,
  onNext,
}: Props) {
  return (
    <nav className="detail-nav" aria-label={`${noun} 이동`}>
      <button type="button" className="admin-button" disabled={busy} onClick={onBack}>
        <span aria-hidden="true">←</span> 목록으로
      </button>
      <div className="detail-nav__step">
        {position && (
          <span className="detail-nav__position">
            {(position.index + 1).toLocaleString()} / {position.total.toLocaleString()}
          </span>
        )}
        <button
          type="button"
          className="admin-button"
          disabled={busy || !onPrevious}
          onClick={onPrevious}
        >
          이전 {noun}
        </button>
        <button type="button" className="admin-button" disabled={busy || !onNext} onClick={onNext}>
          다음 {noun}
        </button>
      </div>
    </nav>
  );
}
