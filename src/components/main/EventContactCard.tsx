import type { CurrentEvent } from '../../api/eventApi';

/** 문의 및 운영 정보: 행사에 등록된 연락처만 보여 줍니다(메인페이지·행사안내 페이지 공통). */
export default function EventContactCard({ currentEvent }: { currentEvent: CurrentEvent | null }) {
  const contactPhone = currentEvent?.contactPhone?.trim() ?? '';
  const contactEmail = currentEvent?.contactEmail?.trim() ?? '';
  const kakaoOpenChatUrl = currentEvent?.kakaoOpenChatUrl?.trim() ?? '';
  const hasKakaoOpenChat = /^https?:\/\//.test(kakaoOpenChatUrl);

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
        {hasKakaoOpenChat && (
          <div className="contact-item">
            <span>운영 채널</span>
            <a href={kakaoOpenChatUrl} target="_blank" rel="noopener noreferrer">
              카카오톡 오픈채팅
            </a>
          </div>
        )}
        <div className="contact-item">
          <span>소속</span>
          <b>글로벌캠퍼스 도서관</b>
        </div>
      </div>
    </div>
  );
}
