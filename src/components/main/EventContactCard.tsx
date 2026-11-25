import { Link } from 'react-router-dom';
import type { CurrentEvent } from '../../api/eventApi';

/**
 * 문의 및 운영 정보: 행사에 등록된 연락처와 문의 게시판 바로가기(메인페이지·행사안내 페이지 공통).
 * 카카오톡 오픈채팅은 더 이상 안내하지 않습니다(서버의 kakaoOpenChatUrl 값은 그대로 둡니다).
 */
export default function EventContactCard({ currentEvent }: { currentEvent: CurrentEvent | null }) {
  const contactPhone = currentEvent?.contactPhone?.trim() ?? '';
  const contactEmail = currentEvent?.contactEmail?.trim() ?? '';

  return (
    <div className="contact-card">
      <h3 id="contactTitle">문의 및 운영 정보</h3>

      <div className="contact-grid">
        {contactPhone && (
          <div className="contact-item">
            <span>전화 문의</span>
            <b>{contactPhone}</b>
          </div>
        )}
        {contactEmail && (
          <div className="contact-item">
            <span>이메일</span>
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          </div>
        )}
        <div className="contact-item">
          <span>소속</span>
          <b>글로벌캠퍼스 도서관</b>
        </div>
      </div>

      <Link to="/inquiries" className="contact-board-link">
        문의 게시판 바로가기 <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
