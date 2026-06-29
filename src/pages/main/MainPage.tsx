import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './MainPage.css'

type ExternalLink = {
  eyebrow: string;
  title: string;
  href: string;
  external?: boolean;
};

type Course = {
  name: string;
  distance: string;
  pages: string;
  books: string;
  monthly: string;
  reward: ReactNode;
  loan: string;
  people: string;
};

const APPLY_FORM_URL = 'https://forms.gle/QxsWgxTH7AmRUbfB9';

const HERO_INFO: [string, string][] = [
  ['운영기간', '2025. 12. 8.(월) — 2026. 2. 1.(일)'],
  ['신청기간', '2025. 11. 24.(월) — 12. 7.(일)'],
  ['참가대상', '글로벌캠퍼스 학부 재학생(휴학생 제외)'],
];

const QUICK_LINKS: ExternalLink[] = [
  { eyebrow: 'Step 1', title: '코스 선택하기', href: '#courses' },
  { eyebrow: 'Step 2', title: '참여방법 확인', href: '#process' },
  {
    eyebrow: 'Step 3',
    title: '참가신청 작성',
    href: APPLY_FORM_URL,
    external: true,
  },
  { eyebrow: 'Status', title: '대회 현황 보기', href: '#status' },
];

const SUMMARY_ITEMS: [string, string][] = [
  ['환산기준', '책 1쪽을 5m로 환산'],
  ['기록방법', '독서일지에 도서 정보와 읽은 페이지 수 입력'],
  ['서평작성', '도서관 홈페이지 로그인 후 해당 도서 상세페이지에서 작성'],
  ['결과확인', '누적 거리와 코스별 완주 여부를 대회 현황에서 확인'],
];

const COURSES: Course[] = [
  {
    name: '단축코스',
    distance: '10,000m',
    pages: '2,000쪽',
    books: '7권',
    monthly: '2.3권',
    reward: '문화상품권 3만원권',
    loan: '2권',
    people: '15명',
  },
  {
    name: '하프코스',
    distance: '21,100m',
    pages: '4,220쪽',
    books: '14권',
    monthly: '4.6권',
    reward: '문화상품권 5만원권',
    loan: '2권',
    people: '20명',
  },
  {
    name: '풀코스',
    distance: '42,195m',
    pages: '8,439쪽',
    books: '28권',
    monthly: '9.3권',
    reward: (
      <>
        상금 150,000원
        <br />
        <small>기타소득세 22% 공제 후 지급</small>
      </>
    ),
    loan: '5권',
    people: '3명',
  },
];

const PROCESS_STEPS = [
  {
    no: 1,
    title: '참가 신청',
    desc: '참가신청서를 작성하고 신청 정보를 제출합니다. 제출 후 승인 안내를 확인해 주세요.',
  },
  {
    no: 2,
    title: '코스 선택',
    desc: '단축·하프·풀코스 중 목표 독서량에 맞는 코스를 선택합니다.',
  },
  {
    no: 3,
    title: '독서일지 제출',
    desc: '도서명, 저자, 출판사, 읽은 페이지 수를 입력합니다. 페이지 수는 거리로 자동 환산됩니다.',
  },
  {
    no: 4,
    title: '현황 확인',
    desc: '누적 거리, 달성률, 완주 여부와 공지사항을 대회 현황에서 확인합니다.',
  },
];

const STATUS_ITEMS = [
  {
    title: '나의 누적 거리',
    value: '운영 시작 후 공개',
    desc: '인정된 독서일지를 기준으로 자동 집계됩니다.',
  },
  {
    title: '코스별 완주 현황',
    value: '준비 중',
    desc: '단축·하프·풀코스별 달성 현황을 제공합니다.',
  },
  {
    title: '공개 순위',
    value: '이름 마스킹 적용',
    desc: '개인정보 보호 기준에 따라 일부 정보만 공개합니다.',
  },
];

const NOTICES = [
  {
    badge: '신청',
    title: '제5회 독서마라톤 참가 신청 안내',
    href: '#process',
    date: '2025.11.24',
    dateTime: '2025-11-24',
  },
  {
    badge: '코스',
    title: '코스별 완주 기준 및 혜택 안내',
    href: '#courses',
    date: '2025.11.24',
    dateTime: '2025-11-24',
  },
  {
    badge: '기록',
    title: '독서일지 제출 및 인정 기준 안내',
    href: '#process',
    date: '2025.12.08',
    dateTime: '2025-12-08',
  },
  {
    badge: '문의',
    title: '서평 작성 및 문의 채널 안내',
    href: '#contact',
    date: '2025.12.08',
    dateTime: '2025-12-08',
  },
];

const CHECK_ITEMS = [
  '독서일지에는 도서 정보와 읽은 페이지 수를 정확히 입력해야 합니다.',
  '만화, 전공서적, 수험서, 원서, 정기간행물 등은 인정 대상에서 제외될 수 있습니다.',
  '서평은 도서관 홈페이지 로그인 후 해당 도서 상세페이지에서 작성합니다.',
  '상금 및 문화상품권 지급 대상과 기준은 도서관 공지사항을 따릅니다.',
];

const MY_RECORD = {
  course: '하프코스',
  targetDistance: 21100,
  totalDistance: 4025,
  totalPages: 805,
  approvedLogs: 4,
  lastSubmittedAt: '2025. 12. 18.',
};

function externalAttrs(link: { external?: boolean }) {
  return link.external ? { target: '_blank' as const, rel: 'noopener noreferrer' } : {};
}

function formatDistance(distance: number) {
  return distance >= 1000
    ? `${(distance / 1000).toFixed(2)}km`
    : `${distance.toLocaleString()}m`;
}

function getDisplayName() {
  const storedName = localStorage.getItem('userName');
  const loginId = localStorage.getItem('loginId');

  if (storedName?.trim()) {
    return storedName.trim();
  }

  if (loginId?.trim()) {
    return loginId.includes('@') ? loginId.split('@')[0] : loginId;
  }

  return '참가자';
}

function MainPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem('isLoggedIn') === 'true',
  );

  const [isApplied, setIsApplied] = useState(
    () =>
      localStorage.getItem('isApplied') === 'true' ||
      localStorage.getItem('isLoggedIn') === 'true',
  );

  const [displayName, setDisplayName] = useState(() => getDisplayName());

  const progressRate = useMemo(() => {
    return Math.min(
      Math.round((MY_RECORD.totalDistance / MY_RECORD.targetDistance) * 100),
      100,
    );
  }, []);

  useEffect(() => {
    const syncAuthState = () => {
      const nextIsLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

      setIsLoggedIn(nextIsLoggedIn);
      setIsApplied(
        localStorage.getItem('isApplied') === 'true' || nextIsLoggedIn,
      );
      setDisplayName(getDisplayName());
    };

    syncAuthState();

    window.addEventListener('auth-change', syncAuthState);
    window.addEventListener('storage', syncAuthState);

    return () => {
      window.removeEventListener('auth-change', syncAuthState);
      window.removeEventListener('storage', syncAuthState);
    };
  }, []);

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

  const showMyRecord = isLoggedIn && isApplied;

  return (
    <>
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
                    제5회 독서마라톤
                    <span>{displayName}님, 환영합니다.</span>
                  </h1>

                  <p className="hero-copy hero-copy-personal">
                    {MY_RECORD.course} 완주를 향해 오늘도 한 걸음 더 달려볼까요?
                  </p>
                </div>
              ) : (
                <>
                  <h1 id="heroTitle">
                    제5회 독서마라톤
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
                  <a
                    className="btn btn-primary"
                    href={APPLY_FORM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    참가신청 바로가기
                  </a>
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
                <div className="my-record-dashboard">
                  <div className="my-record-dashboard-head">
                    <div>
                      <span>My Record</span>
                      <h2>나의 기록</h2>
                    </div>
                    <b>{MY_RECORD.course}</b>
                  </div>

                  <div className="my-record-main">
                    <span>누적 독서 거리</span>
                    <strong>{formatDistance(MY_RECORD.totalDistance)}</strong>
                    <p>
                      목표 거리 {formatDistance(MY_RECORD.targetDistance)} 중{' '}
                      {progressRate}% 달성했습니다.
                    </p>
                  </div>

                  <div className="my-record-progress">
                    <div className="my-record-progress-top">
                      <span>달성률</span>
                      <b>{progressRate}%</b>
                    </div>
                    <div
                      className="my-record-progress-track"
                      aria-label={`목표 달성률 ${progressRate}%`}
                    >
                      <span style={{ width: `${progressRate}%` }} />
                    </div>
                  </div>

                  <dl className="my-record-meta">
                    <div>
                      <dt>인정 페이지</dt>
                      <dd>{MY_RECORD.totalPages.toLocaleString()}쪽</dd>
                    </div>
                    <div>
                      <dt>독서일지</dt>
                      <dd>{MY_RECORD.approvedLogs}건</dd>
                    </div>
                    <div>
                      <dt>최근 제출</dt>
                      <dd>{MY_RECORD.lastSubmittedAt}</dd>
                    </div>
                  </dl>

                  <div className="my-record-dashboard-actions">
                    <Link to="/my">나의 전체 기록 보기</Link>
                  </div>
                </div>
              ) : (
                <div className="status-board">
                  <div className="status-board-head">
                    <span>Reading Marathon 2025-2026</span>
                    <b>운영 예정</b>
                  </div>

                  <ul className="hero-info-list">
                    {HERO_INFO.map(([label, value]) => (
                      <li key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </li>
                    ))}
                  </ul>

                  <div className="conversion-box">
                    <span>환산 기준</span>
                    <strong>1쪽 = 5m</strong>
                    <p>
                      입력한 페이지 수는 누적 거리와 완주율로 자동 계산됩니다.
                    </p>
                  </div>
                </div>
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
              <a key={link.title} href={link.href} {...externalAttrs(link)}>
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
                <ul className="notice-list">
                  {NOTICES.map((notice) => (
                    <li key={notice.title}>
                      <a href={notice.href}>
                        <span className="badge">{notice.badge}</span>
                        <strong>{notice.title}</strong>
                        <time dateTime={notice.dateTime}>{notice.date}</time>
                      </a>
                    </li>
                  ))}
                </ul>
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

            <div className="table-scroll official-card fade-up">
              <table className="program-table">
                <caption className="sr-only">제5회 독서마라톤 코스 및 혜택 표</caption>
                <thead>
                  <tr>
                    <th scope="col">코스명</th>
                    <th scope="col">목표 거리</th>
                    <th scope="col">목표 페이지</th>
                    <th scope="col">
                      독서권수
                      <br />
                      <small>300쪽 기준</small>
                    </th>
                    <th scope="col">
                      평균 1개월
                      <br />
                      독서량
                    </th>
                    <th scope="col">상금 또는 문화상품권</th>
                    <th scope="col">추가대출</th>
                    <th scope="col">인원</th>
                  </tr>
                </thead>
                <tbody>
                  {COURSES.map((course) => (
                    <tr key={course.name}>
                      <th scope="row">{course.name}</th>
                      <td>{course.distance}</td>
                      <td>{course.pages}</td>
                      <td>{course.books}</td>
                      <td>{course.monthly}</td>
                      <td>{course.reward}</td>
                      <td>{course.loan}</td>
                      <td>{course.people}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
    </>
  );
}

export default MainPage;