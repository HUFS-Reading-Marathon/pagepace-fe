/** 행사 개요 카드: 독서마라톤 설명과 핵심 수치(메인페이지·행사안내 페이지 공통) */
export default function EventAboutCard({ courseCount }: { courseCount: number }) {
  return (
    <article className="official-card about-card">
      <h3>독서마라톤이란?</h3>
      <p>
        읽은 쪽수를 거리로 환산해 누적하고, 선택한 코스의 목표 거리에 도달하면 완주로 인정합니다.
        독서일지는 접수기간 안에 제출하며, 인정 여부는 도서관 기준에 따라 결정됩니다.
      </p>

      <div className="about-highlight" aria-label="독서마라톤 핵심 수치">
        <div>
          <b>1쪽 = 5m</b>
          <span>독서량을 거리로 환산</span>
        </div>
        <div>
          <b>접수기간 내 제출</b>
          <span>독서일지 접수기간에 기록 제출</span>
        </div>
        <div>
          <b>{courseCount}개 코스</b>
          <span>공개된 코스 중 선택</span>
        </div>
      </div>
    </article>
  );
}
