import { getEventStatusLabel } from '../../types/adminEvent';

type EventStatusBoardProps = {
  heroInfo: [string, string][];
  /** 현재 공개 행사의 회차. 행사 정보가 없으면 생략합니다. */
  roundNo?: number;
  /** 서버 행사 상태 값(APPLICATION_OPEN 등). 라벨은 관리자 화면과 같은 기준을 사용합니다. */
  status?: string;
};

/** 비로그인 사용자의 메인 화면 우측 운영 정보 카드 */
function EventStatusBoard({ heroInfo, roundNo, status }: EventStatusBoardProps) {
  const statusLabel = getEventStatusLabel(status);

  return (
    <div className="status-board">
      <div className="status-board-head">
        <span>{roundNo ? `제${roundNo}회 독서마라톤` : '독서마라톤'}</span>
        {statusLabel && <b>{statusLabel}</b>}
      </div>

      <ul className="hero-info-list">
        {heroInfo.map(([label, value]) => (
          <li key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </li>
        ))}
      </ul>

      <div className="conversion-box">
        <span>환산 기준</span>
        <strong>1쪽 = 5m</strong>
        <p>입력한 페이지 수는 누적 거리와 완주율로 자동 계산됩니다.</p>
      </div>
    </div>
  );
}

export default EventStatusBoard;
