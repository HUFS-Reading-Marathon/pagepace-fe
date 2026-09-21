import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth';
import { getCurrentEvent, getEventCourses, type CurrentEvent } from '../../api/eventApi';
import { getCurrentParticipation } from '../../api/participationApi';
import { getMyReadingLogs } from '../../api/readingLogApi';
import { getNotices, type Notice } from '../../api/noticeApi';
import CourseBenefitTable from '../../components/main/CourseBenefitTable';
import EventStatusBoard from '../../components/main/EventStatusBoard';
import MainNoticeList from '../../components/main/MainNoticeList';
import MyRecordDashboard from '../../components/main/MyRecordDashboard';
import type { MyParticipation } from '../../types/participation';
import { getExternalLinkAttrs } from '../../utils/links';
import {
  APPLY_FORM_URL,
  CHECK_ITEMS,
  FALLBACK_COURSES,
  FALLBACK_EVENT_TITLE,
  FALLBACK_HERO_INFO,
  FALLBACK_MY_RECORD,
  FALLBACK_NOTICES,
  PROCESS_STEPS,
  QUICK_LINKS,
  STATUS_ITEMS,
  SUMMARY_ITEMS,
  toCourseRow,
  type CourseRow,
  type MyRecordSummary,
} from './mainPageContent';
import './MainPage.css'

const NOTICE_PREVIEW_COUNT = 4;

function MainPage() {
  const { user, isAuthenticated, isInitializing } = useAuth();
  const isApplied =
    localStorage.getItem('isApplied') === 'true' || isAuthenticated;
  const displayName = user?.name || '참가자';
  const [currentEvent, setCurrentEvent] = useState<CurrentEvent | null>(null);
  const [eventCourses, setEventCourses] = useState<CourseRow[]>(FALLBACK_COURSES);
  const [myParticipation, setMyParticipation] = useState<MyParticipation | null>(null);
  const [approvedLogs, setApprovedLogs] = useState(0);
  const [lastSubmittedAt, setLastSubmittedAt] = useState('-');
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    getNotices().then(setNotices).catch(() => setNotices([]));
  }, []);

  useEffect(() => {
    getCurrentEvent()
      .then(async (event) => {
        setCurrentEvent(event);
        const courses = await getEventCourses(event.eventId);
        setEventCourses(courses.map(toCourseRow));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    getCurrentParticipation()
      .then(async (participation) => {
        setMyParticipation(participation);
        const logs = await getMyReadingLogs(participation.participationId);
        setApprovedLogs(logs.filter((log) => log.status === 'APPROVED').length);
        setLastSubmittedAt(
          [...logs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
            ?.readingDate ?? '-',
        );
      })
      .catch(() => undefined);
  }, [isAuthenticated]);

  const eventTitle = currentEvent?.title ?? FALLBACK_EVENT_TITLE;
  const heroInfo: [string, string][] = currentEvent
    ? [
        ['운영기간', `${currentEvent.eventStartDate} — ${currentEvent.eventEndDate}`],
        ['신청기간', `${currentEvent.applicationStartDate} — ${currentEvent.applicationEndDate}`],
        ['문의', currentEvent.contactPhone || currentEvent.contactEmail],
      ]
    : FALLBACK_HERO_INFO;
  const myRecord: MyRecordSummary = myParticipation
    ? {
        course: myParticipation.courseName,
        targetDistance: myParticipation.targetDistanceMeter,
        totalDistance: myParticipation.totalDistanceMeter,
        totalPages: myParticipation.totalPages,
        approvedLogs,
        lastSubmittedAt,
      }
    : FALLBACK_MY_RECORD;

  useEffect(() => {
    const elements = document.querySelectorAll('.fade-up');

    if (!('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 },
    );

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  const showMyRecord = (isAuthenticated || isInitializing) && isApplied;

  return (
    <main id="main">
      <section className="hero" aria-labelledby="heroTitle">
        <div className="wrap hero-inner">
          <div
            className={[
              'hero-content',
              'hero-content-nude',
              showMyRecord ? 'hero-content-personal' : 'hero-content-public',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="eyebrow">HUFS Global Campus Library</div>

            {showMyRecord ? (
              <div className="personal-hero-message">
                <h1 id="heroTitle">
                  {eventTitle}
                  <span>{displayName}님, 환영합니다.</span>
                </h1>

                <p className="hero-copy hero-copy-personal">
                  {myRecord.course} 완주를 향해 오늘도 한 걸음 더 달려볼까요?
                </p>
              </div>
            ) : (
              <>
                <h1 id="heroTitle">
                  {eventTitle}
                  <span>읽은 페이지를 거리로 환산하는 독서기록 프로그램</span>
                </h1>

                <p className="hero-copy-public">
                  한국외국어대학교 글로벌캠퍼스 도서관은 구성원의 지속적인 독서
                  활동을 지원하기 위해 제5회 독서마라톤을 운영합니다. 참가자는
                  읽은 페이지 수를 기록하고 누적 거리에 따라 선택한 코스의 완주
                  여부를 확인할 수 있습니다.
                </p>
              </>
            )}

            <div
              className="hero-actions hero-actions-minimal"
              aria-label="주요 이동 버튼"
            >
              {showMyRecord ? (
                <Link className="btn btn-primary" to="/logs/new">
                  독서일지 작성하기
                </Link>
              ) : (
                <Link className="btn btn-primary" to="/apply">
                  참가신청 바로가기
                </Link>
              )}

              <div className="hero-text-links">
                <a href="#status">대회 현황 보기</a>
              </div>
            </div>
          </div>

          <aside
            className="hero-visual fade-up"
            aria-label={showMyRecord ? '나의 독서마라톤 기록' : '독서마라톤 운영 정보'}
          >
            {showMyRecord ? (
              <MyRecordDashboard record={myRecord} />
            ) : (
              <EventStatusBoard heroInfo={heroInfo} />
            )}
          </aside>
        </div>
      </section>

      <section className="info-section" aria-label="운영 정보 및 빠른 메뉴">
        <div className="wrap info-layout">
          <aside className="summary-card fade-up">
            <div className="summary-head">
              <p>Program Information</p>
              <h2>운영 정보</h2>
            </div>
            <ul className="summary-list">
              {SUMMARY_ITEMS.map(([label, value]) => (
                <li key={label}>
                  <b>{label}</b>
                  <span>{value}</span>
                </li>
              ))}
            </ul>
          </aside>

          <div className="library-search-card fade-up">
            <label htmlFor="libSearch">도서관 소장자료 검색</label>
            <p>
              독서마라톤 참여 도서를 찾을 때 도서명, 저자명, 키워드로
              도서관 자료를 검색할 수 있습니다.
            </p>
            <form
              className="search-row"
              action="https://lib.hufs.ac.kr/global/search/tot/result"
              method="get"
              target="_blank"
              aria-label="도서관 자료 검색"
            >
              <input
                id="libSearch"
                name="q"
                type="search"
                placeholder="도서명, 저자, 키워드 검색"
                autoComplete="off"
              />
              <button type="submit">검색</button>
            </form>
          </div>
        </div>

        <div className="wrap quick-grid fade-up" aria-label="빠른 메뉴">
          {QUICK_LINKS.map((link) => (
            <a key={link.title} href={link.href} {...getExternalLinkAttrs(link)}>
              <small>{link.eyebrow}</small>
              <strong>{link.title}</strong>
            </a>
          ))}
        </div>
      </section>

      <section className="section compact" id="about" aria-labelledby="aboutTitle">
        <div className="wrap">
          <div className="section-head fade-up">
            <div className="section-title">
              <p>Program Overview</p>
              <h2 id="aboutTitle">행사 개요</h2>
            </div>
            <p className="section-desc">
              독서마라톤은 독서량을 거리로 환산하여 목표 코스 완주를
              지원하는 도서관 독서기록 프로그램입니다.
            </p>
          </div>

          <div className="notice-layout">
            <article className="official-card about-card fade-up">
              <h3>독서마라톤이란?</h3>
              <p>
                책 1쪽을 5m로 환산하여 누적 거리를 계산하고, 참가자가 선택한
                코스의 목표 거리에 도달하면 완주로 인정하는 독서기록 행사입니다.
                운영 기간 동안 독서일지를 제출하며, 도서관 안내 기준에 따라
                기록 인정 여부가 결정됩니다.
              </p>

              <div className="about-highlight" aria-label="독서마라톤 핵심 수치">
                <div>
                  <b>1쪽 = 5m</b>
                  <span>독서량을 거리로 환산</span>
                </div>
                <div>
                  <b>8주간</b>
                  <span>정해진 운영 기간 내 기록 제출</span>
                </div>
                <div>
                  <b>3개 코스</b>
                  <span>단축·하프·풀코스 중 선택</span>
                </div>
              </div>
            </article>

            <aside
              className="official-card news-card fade-up"
              id="notice"
              aria-labelledby="noticeTitle"
            >
              <div className="card-title-row">
                <h3 id="noticeTitle">공지사항</h3>
                <a href="#contact">문의하기</a>
              </div>
              <MainNoticeList
                notices={notices}
                fallbackNotices={FALLBACK_NOTICES}
                maxCount={NOTICE_PREVIEW_COUNT}
              />
            </aside>
          </div>
        </div>
      </section>

      <section className="section tone-section" id="status" aria-labelledby="statusTitle">
        <div className="wrap">
          <div className="section-head fade-up">
            <div className="section-title">
              <p>Marathon Status</p>
              <h2 id="statusTitle">대회 현황</h2>
            </div>

            <p className="section-desc">
              운영 시작 후 참가자의 독서일지 제출 내역을 기준으로 누적 거리,
              달성률, 완주 여부가 집계됩니다.
            </p>
          </div>

          <div className="status-grid fade-up">
            {STATUS_ITEMS.map((item) => (
              <article className="status-card" key={item.title}>
                <span>{item.title}</span>
                <strong>{item.value}</strong>
                <p>{item.desc}</p>
              </article>
            ))}
          </div>

          <div className="status-detail-row fade-up">
            <Link to="/status" className="status-detail-link">
              대회 현황 보러가기
            </Link>
          </div>
        </div>
      </section>

      <section className="section" id="courses" aria-labelledby="coursesTitle">
        <div className="wrap">
          <div className="section-head fade-up">
            <div className="section-title">
              <p>Course & Benefits</p>
              <h2 id="coursesTitle">코스 및 혜택</h2>
            </div>
            <p className="section-desc">
              각 코스는 목표 거리와 목표 페이지 수를 기준으로 운영됩니다.
              완주 기준과 혜택은 코스별로 다릅니다.
            </p>
          </div>

          <CourseBenefitTable courses={eventCourses} />

          <p className="table-note fade-up">
            추가대출기간: 2026. 3. 1. — 8. 31. / 상품 지급 기준은 도서관
            공지사항 및 최종 운영 기준을 따릅니다.
          </p>
        </div>
      </section>

      <section className="section" id="process" aria-labelledby="processTitle">
        <div className="wrap">
          <div className="section-head fade-up">
            <div className="section-title">
              <p>How to Participate</p>
              <h2 id="processTitle">참여방법</h2>
            </div>
            <p className="section-desc">
              참가 신청 후 안내에 따라 독서일지를 제출합니다. 제출된 기록은
              페이지 수 기준으로 거리 환산 및 누적 집계됩니다.
            </p>
          </div>

          <div className="process fade-up">
            {PROCESS_STEPS.map((step) => (
              <article className="process-step" key={step.no}>
                <span className="step-no">{step.no}</span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="contact" aria-labelledby="contactTitle">
        <div className="wrap two-col">
          <aside className="check-card fade-up">
            <h2>참여 전 확인사항</h2>
            <p>
              독서일지 제출 전 아래 항목을 확인해 주세요. 세부 기준은 도서관
              공지사항을 우선합니다.
            </p>
            <ul className="check-list">
              {CHECK_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </aside>

          <div className="contact-card fade-up">
            <h3 id="contactTitle">문의 및 운영 정보</h3>
            <p>
              행사 관련 공지, 신청 확인, 기록 제출 및 서평 작성 문의는
              도서관 안내 채널을 통해 확인해 주세요.
            </p>

            <div className="contact-grid">
              <div className="contact-item">
                <span>전화 문의</span>
                <b>031-330-4927</b>
              </div>
              <div className="contact-item">
                <span>이메일</span>
                <a href="mailto:jhpark@hufs.ac.kr">jhpark@hufs.ac.kr</a>
              </div>
              <div className="contact-item">
                <span>운영 채널</span>
                <a
                  href="https://open.kakao.com/o/gfTnKI3h"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  카카오톡 오픈채팅
                </a>
              </div>
              <div className="contact-item">
                <span>소속</span>
                <b>글로벌캠퍼스 도서관</b>
              </div>
            </div>
          </div>
        </div>

        <div className="wrap cta-band fade-up">
          <div>
            <h2>
              {showMyRecord
                ? '오늘 읽은 기록을 독서일지로 남겨보세요'
                : '제5회 독서마라톤 참가신청'}
            </h2>
            <p>
              {showMyRecord
                ? '읽은 페이지 수를 입력하면 누적 거리와 완주율에 반영됩니다.'
                : '신청 기간과 참가 대상 확인 후 참가신청서를 제출해 주세요.'}
            </p>
          </div>

          {showMyRecord ? (
            <Link className="btn btn-navy" to="/logs/new">
              독서일지 작성하기
            </Link>
          ) : (
            <a
              className="btn btn-navy"
              href={APPLY_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              참가신청서 열기
            </a>
          )}
        </div>
      </section>
    </main>
  );
}

export default MainPage;
