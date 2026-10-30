type EventStatusBoardProps = {
  heroInfo: [string, string][];
};

/** 비로그인 사용자의 메인 화면 우측 운영 정보 카드 */
function EventStatusBoard({ heroInfo }: EventStatusBoardProps) {
  return (
    <div className="status-board">
      <div className="status-board-head">
        <span>Reading Marathon 2025-2026</span>
        <b>운영 예정</b>
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
