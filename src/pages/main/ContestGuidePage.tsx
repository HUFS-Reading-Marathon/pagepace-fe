import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth';
import { getEvent, getCurrentEvent, getEventCourses, type CurrentEvent } from '../../api/eventApi';
import { getApiErrorMessage } from '../../api/apiClient';
import { selectedEventId } from '../../utils/eventSelection';
import { CHECK_ITEMS, PROCESS_STEPS, toCourseRow, type CourseRow } from './mainPageContent';
import CourseBenefitTable from '../../components/main/CourseBenefitTable';
import ProcessStepIcon from '../../components/main/ProcessStepIcon';
import './MainPage.css';

export default function ContestGuidePage({
  section,
}: {
  section: 'about' | 'courses' | 'process';
}) {
  const { isAuthenticated, isInitializing } = useAuth();
  const eventId = isAuthenticated ? selectedEventId('personal') : undefined;
  const [event, setEvent] = useState<CurrentEvent | null>(null);
  const [eventCourses, setCourses] = useState<CourseRow[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(true);
  useEffect(() => {
    if (isInitializing || section === 'process') return;
    let active = true;
    (async () => {
      const result = eventId ? await getEvent(eventId) : await getCurrentEvent();
      const rows = await getEventCourses(result.eventId);
      if (active) {
        setEvent(result);
        setCourses(rows.map(toCourseRow));
        setError('');
      }
    })()
      .catch((err) => {
        if (active) setError(getApiErrorMessage(err, '행사 정보를 불러오지 못했습니다.'));
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [eventId, isInitializing, section]);
  const contactPhone = event?.contactPhone?.trim();
  const contactEmail = event?.contactEmail?.trim();
  const kakaoOpenChatUrl = event?.kakaoOpenChatUrl?.trim() ?? '';
  const hasKakaoOpenChat = /^https?:\/\//.test(kakaoOpenChatUrl);
  return (
    <main id="main" className="contest-guide">
      {section !== 'process' &&
        (error ? (
          <p className="wrap" role="alert">
            {error}
          </p>
        ) : pending ? (
          <p className="wrap" role="status">
            행사 정보를 불러오는 중입니다.
          </p>
        ) : (
          <p className="wrap guide-event">
            {event?.title} · {event?.eventStartDate} ~ {event?.eventEndDate}
          </p>
        ))}
      {section === 'about' && (
        <>
          <section className="section compact" id="about" aria-labelledby="aboutTitle">
            <div className="wrap" data-reveal>
              <div className="section-head">
                <div className="section-title">
                  <h1 id="aboutTitle">행사안내</h1>
                </div>
              </div>

              <article className="official-card about-card">
                <h3>독서마라톤이란?</h3>
                <p>
                  읽은 쪽수를 거리로 환산해 누적하고, 선택한 코스의 목표 거리에 도달하면 완주로
                  인정합니다. 독서일지는 접수기간 안에 제출하며, 인정 여부는 도서관 기준에 따라
                  결정됩니다.
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
                    <b>{eventCourses.length ? eventCourses.length + '개 코스' : '코스 준비 중'}</b>
                    <span>공개된 코스 중 선택</span>
                  </div>
                </div>
              </article>
            </div>
          </section>
          <section className="section" id="contact" aria-labelledby="contactTitle">
            <div className="wrap two-col" data-reveal>
              <aside className="check-card">
                <h2>참여 전 확인사항</h2>
                <p>세부 기준은 공지사항을 따릅니다.</p>
                <ul className="check-list">
                  {CHECK_ITEMS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </aside>

              <div className="contact-card">
                <h3 id="contactTitle">문의 및 운영 정보</h3>
                <Link to="/inquiries">문의 게시판 열기</Link>

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
            </div>
          </section>
        </>
      )}
      {section === 'courses' && (
        <section className="section" id="courses" aria-labelledby="coursesTitle">
          <div className="wrap" data-reveal>
            <div className="section-head">
              <div className="section-title">
                <h1 id="coursesTitle">코스 및 혜택</h1>
              </div>
            </div>

            {eventCourses.length > 0 ? (
              <CourseBenefitTable courses={eventCourses} />
            ) : (
              !pending && <p>등록된 코스가 없습니다.</p>
            )}

            <p className="table-note">추가 대출 기간과 시상 기준은 공지사항을 따릅니다.</p>
          </div>
        </section>
      )}
      {section === 'process' && (
        <section className="section" id="process" aria-labelledby="processTitle">
          <div className="wrap" data-reveal>
            <div className="section-head">
              <div className="section-title">
                <h1 id="processTitle">참여방법</h1>
              </div>
            </div>

            <ol className="process">
              {PROCESS_STEPS.map((step) => (
                <li className="process-step" key={step.no}>
                  <span className="process-icon">
                    <ProcessStepIcon name={step.icon} />
                    <span className="step-no" aria-hidden="true">
                      {step.no}
                    </span>
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </li>
              ))}
            </ol>

            <div className="process-note">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8h.01" />
              </svg>
              <p>
                <span>같은 책의 독서일지는 합산합니다.</span>
                <span>서평을 한 번 확인한 책은 이후 일지도 승인되는 즉시 거리로 반영됩니다.</span>
                <small>서평 확인을 기다리는 동안에도 다음 독서일지를 제출할 수 있습니다.</small>
              </p>
            </div>
          </div>
        </section>
      )}
      <nav className="wrap guide-links" aria-label="다음 단계">
        <Link to="/courses">코스 및 혜택</Link>
        <Link to="/apply">참가신청</Link>
        <Link to="/inquiries">문의 게시판</Link>
      </nav>
    </main>
  );
}
