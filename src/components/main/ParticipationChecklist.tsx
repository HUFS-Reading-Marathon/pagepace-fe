import { CHECK_ITEMS } from '../../pages/main/mainPageContent';

/** 참여 전 확인사항(메인페이지·참여방법 페이지 공통) */
export default function ParticipationChecklist() {
  return (
    <aside className="check-card">
      <h2>참여 전 확인사항</h2>
      <p>세부 기준은 공지사항을 따릅니다.</p>
      <ul className="check-list">
        {CHECK_ITEMS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </aside>
  );
}
