/** 목데이터 모드 표시. 개발 서버의 목데이터 모드에서만 불러오며 화면 구성에는 끼어들지 않습니다. */
export default function MockBadge() {
  return (
    <div
      role="note"
      aria-label="목데이터 모드"
      title="목데이터 모드: 실제 서버에 요청하지 않으며, 새로고침하면 처음 상태로 돌아갑니다."
      style={{
        position: 'fixed',
        left: 10,
        bottom: 10,
        zIndex: 2000,
        padding: '2px 7px',
        border: '1px solid #c9d4df',
        borderRadius: 4,
        background: '#fff',
        color: '#7c8996',
        font: '600 10px/1.6 system-ui, sans-serif',
        letterSpacing: '0.08em',
        pointerEvents: 'none',
      }}
    >
      MOCK
    </div>
  );
}
