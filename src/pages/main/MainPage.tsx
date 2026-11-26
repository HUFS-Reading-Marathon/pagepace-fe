import ContentSkeleton from '../../components/layout/ContentSkeleton';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth';
import { getCurrentParticipation } from '../../api/participationApi';
import { getMyReadingLogs } from '../../api/readingLogApi';
import { getNotices, type Notice } from '../../api/noticeApi';
import CourseBenefitTable from '../../components/main/CourseBenefitTable';
import EventAboutCard from '../../components/main/EventAboutCard';
import EventContactCard from '../../components/main/EventContactCard';
import EventStatusBoard from '../../components/main/EventStatusBoard';
import MainNoticeList from '../../components/main/MainNoticeList';
import MyRecordDashboard from '../../components/main/MyRecordDashboard';
import ParticipationChecklist from '../../components/main/ParticipationChecklist';
import ProcessGuide from '../../components/main/ProcessGuide';
import type { MyParticipation } from '../../types/participation';
import { getExternalLinkAttrs } from '../../utils/links';
import { formatKoDateKey } from '../../utils/date';
import {
  getApplicationAvailability,
  getApplicationClosedMessage,
} from '../../utils/eventSelection';
import { QUICK_LINKS, SUMMARY_ITEMS, type MyRecordSummary } from './mainPageContent';
import { useCurrentEventInfo } from './useCurrentEventInfo';
import { useScrollReveal } from './useScrollReveal';
import { posterForRound } from '../info/eventPosters';
import './MainPage.css';

const NOTICE_PREVIEW_COUNT = 3;

function formatDateRange(start: string, end: string) {
  return `${formatKoDateKey(start)} ~ ${formatKoDateKey(end)}`;
}

const LIBRARY_SEARCH_URL = 'https://lib.hufs.ac.kr/global/search/i-discovery';

/** 도서관 통합검색(i-discovery) 결과 URL을 만듭니다. 검색어는 `ALL=k|a|<검색어>` 형식으로 전달합니다. */
function buildLibrarySearchUrl(keyword: string) {
  const url = new URL(LIBRARY_SEARCH_URL);
  url.search = new URLSearchParams({ ALL: `k|a|${keyword}`, offset: '0' }).toString();
  return url.toString();
}

function handleLibrarySearchSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const keyword = String(new FormData(event.currentTarget).get('keyword') ?? '').trim();
  if (!keyword) return;
  window.open(buildLibrarySearchUrl(keyword), '_blank', 'noopener,noreferrer');
}

function LibrarySearch({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        compact ? 'library-search-card library-search-card--compact' : 'library-search-card'
      }
      data-reveal={!compact || undefined}
    >
      <label htmlFor="libSearch">도서관 소장자료 검색</label>
      {!compact && <p>읽을 책을 도서관 소장자료에서 찾아보세요.</p>}
      <form
        className="search-row"
        onSubmit={handleLibrarySearchSubmit}
        aria-label="도서관 자료 검색"
      >
        <input
          id="libSearch"
          name="keyword"
          type="search"
          placeholder="도서명, 저자, 키워드 검색"
          autoComplete="off"
        />
        <button type="submit">검색</button>
      </form>
    </div>
  );
}

/** 앱 내부 라우트('/status' 등)면 true. '#courses' 같은 hash와 외부 URL은 <a>로 렌더링합니다. */
function isRouteHref(link: { href: string; external?: boolean }) {
  return !link.external && link.href.startsWith('/');
}

function MainPage() {
  const { hash } = useLocation();
  const { user, isAuthenticated, isInitializing } = useAuth();
  const displayName = user?.name || '참가자';
  const { currentEvent, eventCourses, eventError } = useCurrentEventInfo();
  const owner = user?.userId;
  const [record, setRecord] = useState<{ owner: number; participation: MyParticipation | null }>();
  const myParticipation = record && record.owner === owner ? record.participation : null;
  const [approvedLogs, setApprovedLogs] = useState(0);
  const [lastSubmittedAt, setLastSubmittedAt] = useState('-');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticeError, setNoticeError] = useState('');
  const [failedPoster, setFailedPoster] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  useScrollReveal(mainRef);

  useEffect(() => {
    // 다른 페이지(/status 등)에서 /#notice 같은 링크로 들어오면 브라우저의 fragment 스크롤이
    // React 렌더링보다 먼저 실행되어 섹션을 찾지 못하므로, 마운트 후 직접 스크롤합니다.
    if (!hash) return;

    document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  useEffect(() => {
    getNotices()
      .then(setNotices)
      .catch(() => setNoticeError('공지사항을 불러오지 못했습니다.'));
  }, []);

  useEffect(() => {
    if (isInitializing || !isAuthenticated || owner === undefined) return;
    let active = true;
    getCurrentParticipation()
      .then(async (participation) => {
        if (!active) return;
        setRecord({ owner, participation });
        setApprovedLogs(0);
        setLastSubmittedAt('-');
        const logs = await getMyReadingLogs(participation.participationId);
        if (!active) return;
        setApprovedLogs(logs.filter((log) => log.status === 'APPROVED').length);
        setLastSubmittedAt(
          (() => {
            const latest = [...logs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
            return latest ? formatKoDateKey(latest.readingDate) : '-';
          })(),
        );
      })
      .catch(() => {
        if (active)
          setRecord((current) =>
            current?.owner === owner ? current : { owner, participation: null },
          );
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, isInitializing, owner]);

  const eventTitle = currentEvent?.title ?? '독서마라톤';
  const registeredPoster = posterForRound(currentEvent?.roundNo);
  const poster = registeredPoster?.display === failedPoster ? null : registeredPoster;
  const contactPhone = currentEvent?.contactPhone?.trim() ?? '';
  const contactEmail = currentEvent?.contactEmail?.trim() ?? '';
  // 행사에 등록되지 않은 값은 빈 행으로 두지 않고 숨깁니다.
  const heroInfo: [string, string][] = currentEvent
    ? (
        [
          [
            '신청기간',
            formatDateRange(currentEvent.applicationStartDate, currentEvent.applicationEndDate),
          ],
          [
            '독서일지 접수기간',
            formatDateRange(currentEvent.eventStartDate, currentEvent.eventEndDate),
          ],
          ['문의', contactPhone || contactEmail],
        ] as [string, string][]
      ).filter(([, value]) => value !== '')
    : [];
  const myRecord: MyRecordSummary = myParticipation
    ? {
        course: myParticipation.courseName,
        targetDistance: myParticipation.targetDistanceMeter,
        totalDistance: myParticipation.totalDistanceMeter,
        totalPages: myParticipation.totalPages,
        approvedLogs,
        lastSubmittedAt,
      }
    : {
        course: '참가 정보 없음',
        targetDistance: 0,
        totalDistance: 0,
        totalPages: 0,
        approvedLogs: 0,
        lastSubmittedAt: '-',
      };

  const showMyRecord = isAuthenticated && !isInitializing && myParticipation !== null;
  // 행사 조회 전(null)에는 기존 신청 버튼을 그대로 두어 화면이 깜빡이지 않게 합니다.
  const applyAvailability = currentEvent
    ? getApplicationAvailability(currentEvent)
    : eventError
      ? getApplicationAvailability(null)
      : null;
  const applyClosedMessage =
    applyAvailability && applyAvailability.state !== 'open'
      ? getApplicationClosedMessage(applyAvailability)
      : null;

  return (
    <main id="main" ref={mainRef}>
      {eventError && (
        <div className="wrap main-load-message">
          {eventError === 'missing' ? (
            <p role="status">현재 공개된 독서마라톤 행사가 없습니다.</p>
          ) : (
            <p role="alert">행사 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
          )}
        </div>
      )}
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
                  <span>읽은 페이지를 거리로 환산하는 도서관 행사</span>
                </h1>

                <p className="hero-copy-public">
                  책 1쪽을 5m로 환산해 원하는 코스에 도전하는 독서마라톤입니다. 읽은 페이지를
                  기록하며 목표 거리까지의 진행 상황을 확인해 보세요.
                </p>
              </>
            )}

            <div className="hero-actions hero-actions-minimal" aria-label="주요 이동 버튼">
              {showMyRecord ? (
                <Link className="btn btn-primary" to="/logs/new">
                  독서일지 작성하기
                </Link>
              ) : applyClosedMessage && !isAuthenticated ? (
                <Link className="btn btn-primary" to="/login">
                  로그인
                </Link>
              ) : applyClosedMessage ? (
                <Link className="btn btn-primary" to="/status">
                  대회 현황 보기
                </Link>
              ) : (
                <Link className="btn btn-primary" to="/apply">
                  참가신청 바로가기
                </Link>
              )}

              {!(applyClosedMessage && isAuthenticated && !showMyRecord) && (
                <div className="hero-text-links">
                  <Link to="/status">대회 현황 보기</Link>
                </div>
              )}
            </div>
            {!showMyRecord && applyClosedMessage && (
              <p className="hero-apply-note" role="status">
                {applyClosedMessage}
              </p>
            )}
          </div>

          <aside
            className="hero-visual"
            aria-label={showMyRecord ? '나의 독서마라톤 기록' : '독서마라톤 운영 정보'}
          >
            {isInitializing || (isAuthenticated && record?.owner !== owner) ? (
              <div className="status-board">
                <ContentSkeleton
                  variant="stats"
                  label="나의 독서마라톤 기록을 확인하고 있습니다."
                />
              </div>
            ) : showMyRecord ? (
              <MyRecordDashboard record={myRecord} />
            ) : (
              <EventStatusBoard
                heroInfo={heroInfo}
                roundNo={currentEvent?.roundNo}
                status={currentEvent?.status}
              />
            )}
          </aside>
        </div>
      </section>

      <section className="info-section" aria-label="운영 정보 및 빠른 메뉴">
        <div className={`wrap info-layout${poster ? ' info-layout--poster' : ''}`}>
          <div className="info-main-column">
            <aside className="summary-card" data-reveal>
              <div className="summary-head">
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
            {poster && <LibrarySearch compact />}
          </div>

          {poster ? (
            <Link
              className="main-event-poster"
              to="/about"
              aria-label={`${eventTitle} 공식 포스터 · 행사안내로 이동`}
            >
              <img
                src={poster.display}
                width={poster.width}
                height={poster.height}
                alt={poster.alt}
                decoding="async"
                onError={() => setFailedPoster(poster.display)}
              />
            </Link>
          ) : (
            <LibrarySearch />
          )}
        </div>

        <div className="wrap quick-grid" aria-label="빠른 메뉴" data-reveal>
          {QUICK_LINKS.map((link) =>
            isRouteHref(link) ? (
              <Link key={link.title} to={link.href}>
                <small>{link.eyebrow}</small>
                <strong>{link.title}</strong>
              </Link>
            ) : (
              <a key={link.title} href={link.href} {...getExternalLinkAttrs(link)}>
                <small>{link.eyebrow}</small>
                <strong>{link.title}</strong>
              </a>
            ),
          )}
        </div>
      </section>

      <section className="section compact" id="about" aria-labelledby="aboutTitle">
        <div className="wrap" data-reveal>
          <div className="section-head">
            <div className="section-title">
              <h2 id="aboutTitle">행사 개요</h2>
            </div>
          </div>

          <EventAboutCard courseCount={eventCourses.length} />
        </div>
      </section>

      <section className="section" id="courses" aria-labelledby="coursesTitle">
        <div className="wrap" data-reveal>
          <div className="section-head">
            <div className="section-title">
              <h2 id="coursesTitle">코스 및 혜택</h2>
            </div>
          </div>

          <CourseBenefitTable courses={eventCourses} />

          <p className="table-note">추가 대출 기간과 시상 기준은 공지사항을 따릅니다.</p>
        </div>
      </section>

      <section className="section" id="process" aria-labelledby="processTitle">
        <div className="wrap" data-reveal>
          <div className="section-head">
            <div className="section-title">
              <h2 id="processTitle">참여방법</h2>
            </div>
          </div>

          <ProcessGuide />
        </div>
      </section>

      <section className="section tone-section" id="notice" aria-labelledby="noticeTitle">
        <div className="wrap" data-reveal>
          <div className="section-head">
            <div className="section-title">
              <h2 id="noticeTitle">공지사항</h2>
            </div>
          </div>

          <div className="news-card">
            <div className="card-title-row">
              <h3>최근 공지</h3>
              <Link to="/notices">
                전체 보기 <span aria-hidden="true">→</span>
              </Link>
            </div>
            {notices.length === 0 && (
              <p className="notice-empty" role="status">
                {noticeError || '등록된 공지사항이 없습니다.'}
              </p>
            )}
            <MainNoticeList
              notices={notices}
              fallbackNotices={[]}
              maxCount={NOTICE_PREVIEW_COUNT}
            />
          </div>
        </div>
      </section>

      <section className="section" id="contact" aria-labelledby="contactTitle">
        <div className="wrap two-col" data-reveal>
          <ParticipationChecklist />

          <EventContactCard currentEvent={currentEvent} />
        </div>

        <div className="wrap cta-band" data-reveal>
          <div>
            <h2>
              {showMyRecord
                ? '오늘 읽은 기록을 독서일지로 남겨보세요'
                : applyClosedMessage
                  ? eventTitle
                  : `${eventTitle} 참가신청`}
            </h2>
            <p>
              {showMyRecord
                ? '일지 승인 시 쪽수, 서평 확인 시 거리와 완주율에 반영됩니다.'
                : (applyClosedMessage ??
                  (currentEvent
                    ? `신청기간 ${formatDateRange(currentEvent.applicationStartDate, currentEvent.applicationEndDate)}`
                    : ''))}
            </p>
          </div>

          {showMyRecord ? (
            <Link className="btn btn-navy" to="/logs/new">
              독서일지 작성하기
            </Link>
          ) : applyClosedMessage ? (
            <Link className="btn btn-navy" to="/status">
              대회 현황 보기
            </Link>
          ) : (
            <Link className="btn btn-navy" to="/apply">
              참가신청하기
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}

export default MainPage;
