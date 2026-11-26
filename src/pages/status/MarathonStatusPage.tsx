import ContentSkeleton from '../../components/layout/ContentSkeleton';
import { useEffect, useRef, useState } from 'react';
import { getApiErrorMessage } from '../../api/apiClient';
import { useAuth } from '../../auth';
import {
  getCurrentEvent,
  getPublicEvents,
  getEventSummary,
  type EventSummary,
  getEventCourses,
  type CurrentEvent,
  type EventCourse,
} from '../../api/eventApi';
import { selectEvent, selectedEventId } from '../../utils/eventSelection';
import { getMyParticipations, getCurrentParticipation } from '../../api/participationApi';
import { getRankings, type Ranking } from '../../api/rankingApi';
import RankingBoard from '../../components/ranking/RankingBoard';
import { formatKoDateTime24 } from '../../utils/date';
import { maskPublicRankings } from '../../utils/nameMask';
import { formatPreciseDistance, getCreditedPages } from '../../utils/reading';
import './status.css';

const STATUS_ERROR_MESSAGE = '대회 현황을 불러오지 못했습니다.';
const COURSE_FILTER_ID = 'statusCourseFilter';

/** initial: 첫 로딩, refreshing: 코스 변경으로 랭킹만 다시 조회 중 */
type LoadState = 'initial' | 'refreshing' | 'ready' | 'empty' | 'error';

function getEventDisplayTitle(event: CurrentEvent) {
  const title = event.title?.trim();

  if (!title) {
    return event.roundNo ? `제${event.roundNo}회 독서마라톤` : '독서마라톤';
  }

  if (!event.roundNo) {
    return title;
  }

  // API의 title에 이미 "제6회", "6회" 등의 회차 정보가 포함되어 있으면
  // 중복해서 붙이지 않고 title을 그대로 사용합니다.
  const roundPattern = new RegExp(`(?:제\\s*)?${event.roundNo}\\s*회`);

  if (roundPattern.test(title)) {
    return title;
  }

  return `제${event.roundNo}회 ${title}`;
}

/**
 * 현황을 보여줄 행사를 정합니다.
 * 로그인한 참가자는 본인이 참가 중인 행사를 우선하고(신청 중인 다음 회차와 다를 수 있음),
 * 참가 정보가 없거나 비로그인이면 현재 행사를 사용합니다.
 */
async function resolveStatusEvent(isAuthenticated: boolean): Promise<CurrentEvent> {
  if (isAuthenticated) {
    try {
      const participation = await getCurrentParticipation();

      return {
        eventId: participation.eventId,
        title: participation.eventTitle,
        roundNo: participation.roundNo,
        applicationStartDate: '',
        applicationEndDate: '',
        eventStartDate: participation.eventStartDate,
        eventEndDate: participation.eventEndDate,
        status: participation.eventStatus,
        description: '',
        contactPhone: '',
        contactEmail: '',
        kakaoOpenChatUrl: '',
      };
    } catch {
      // 참가 정보가 없으면 현재 행사로 대체합니다.
    }
  }

  return getCurrentEvent();
}

/** 수치와 단위를 한 덩어리로 둡니다(줄바꿈 시 단위만 떨어지지 않게). */
function Figure({ value, unit }: { value: string; unit?: string }) {
  return (
    <span className="status-figure">
      {value}
      {unit && <small>{unit}</small>}
    </span>
  );
}

/** 거리 표시("22.00km", "780m")를 수치와 단위로 나눕니다. */
function splitDistance(meters: number) {
  const text = formatPreciseDistance(meters);
  const match = text.match(/^([\d.,]+)\s*(\D+)$/);
  return match ? { value: match[1], unit: match[2] } : { value: text, unit: undefined };
}

function MarathonStatusPage() {
  const { isAuthenticated, isInitializing, user } = useAuth();
  const [events, setEvents] = useState<CurrentEvent[]>([]);
  const [chosenEventId, setChosenEventId] = useState<number | undefined>(
    () => selectedEventId('public') ?? undefined,
  );
  const [summary, setSummary] = useState<EventSummary | null>(null);
  const [mine, setMine] = useState<{
    owner: number;
    eventId: number;
    participationId?: number;
    rank?: number;
    distance: number;
    pages: number;
  } | null>(null);
  const [personalError, setPersonalError] = useState('');
  const [event, setEvent] = useState<CurrentEvent | null>(null);
  const [courses, setCourses] = useState<EventCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | undefined>();
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('initial');
  const [errorMessage, setErrorMessage] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  // 코스를 빠르게 바꿨을 때 늦게 도착한 이전 응답이 최신 결과를 덮어쓰지 않도록 합니다.
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    // 세션 확인이 끝난 뒤 한 번만 조회해 참가 정보/행사 요청이 중복되지 않게 합니다.
    if (isInitializing) return;

    let active = true;
    const sequence = ++requestSequenceRef.current;

    const loadStatus = async () => {
      setLoadState('initial');

      try {
        const nextEvents = await getPublicEvents();
        // 공개 행사가 없는 것은 오류가 아니므로 중립 안내로 표시합니다.
        if (nextEvents.length === 0) {
          if (!active || requestSequenceRef.current !== sequence) return;
          setEvents([]);
          setLoadState('empty');
          return;
        }
        const preferred = nextEvents.find((item) => item.eventId === chosenEventId);
        const resolved = preferred ?? (await resolveStatusEvent(isAuthenticated));
        const nextEvent =
          nextEvents.find((item) => item.eventId === resolved.eventId) ?? nextEvents[0];
        if (!nextEvent) throw new Error('공개된 행사가 없습니다.');
        const [nextCourses, nextRankings, nextSummary] = await Promise.all([
          getEventCourses(nextEvent.eventId),
          getRankings(nextEvent.eventId),
          getEventSummary(nextEvent.eventId),
        ]);

        if (!active || requestSequenceRef.current !== sequence) return;

        setEvents(nextEvents);
        setSummary(nextSummary);
        setEvent(nextEvent);
        setCourses(nextCourses);
        setSelectedCourseId(undefined);
        setRankings(nextRankings);
        setUpdatedAt(new Date());
        setErrorMessage('');
        setLoadState('ready');
      } catch (error: unknown) {
        if (!active || requestSequenceRef.current !== sequence) return;

        setErrorMessage(getApiErrorMessage(error, STATUS_ERROR_MESSAGE));
        setLoadState('error');
      }
    };

    void loadStatus();

    return () => {
      active = false;
    };
  }, [isAuthenticated, isInitializing, chosenEventId]);

  useEffect(() => {
    if (!isAuthenticated || !user || !event) return;
    let active = true;
    getMyParticipations()
      .then(async (rows) => {
        const participation = rows.find(
          (row) =>
            row.eventId === event.eventId &&
            ['APPROVED', 'COMPLETED'].includes(row.participationStatus),
        );
        const courseRankings = participation
          ? await getRankings(event.eventId, participation.courseId)
          : [];
        if (!active) return;
        setMine({
          owner: user.userId,
          eventId: event.eventId,
          participationId: participation?.participationId,
          rank: courseRankings.find((row) => row.participationId === participation?.participationId)
            ?.rank,
          distance: participation?.totalDistanceMeter ?? 0,
          pages: participation?.totalPages ?? 0,
        });
        setPersonalError('');
      })
      .catch(() => {
        if (active) setPersonalError('내 순위를 불러오지 못했습니다.');
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, user, event]);

  const handleCourseChange = async (courseId?: number) => {
    if (!event) return;

    const sequence = ++requestSequenceRef.current;

    setSelectedCourseId(courseId);
    setLoadState('refreshing');

    try {
      const [nextRankings, nextSummary] = await Promise.all([
        getRankings(event.eventId, courseId),
        getEventSummary(event.eventId, courseId),
      ]);
      if (requestSequenceRef.current === sequence) setSummary(nextSummary);

      if (requestSequenceRef.current !== sequence) return;

      setRankings(nextRankings);
      setUpdatedAt(new Date());
      setErrorMessage('');
      setLoadState('ready');
    } catch (error: unknown) {
      if (requestSequenceRef.current !== sequence) return;

      setErrorMessage(getApiErrorMessage(error, STATUS_ERROR_MESSAGE));
      setLoadState('error');
    }
  };

  const isReady = loadState === 'ready' || loadState === 'refreshing';
  const isLoading = loadState === 'initial' || loadState === 'refreshing';

  const isMine =
    isAuthenticated && !!user && mine?.owner === user.userId && mine.eventId === event?.eventId;
  // 다른 참가자의 이름은 가리고 학번은 지웁니다. 본인 행은 인증된 사용자의 참가 ID로 찾아 본인 이름을 보여 줍니다.
  const displayedRankings = maskPublicRankings(
    rankings,
    isMine && mine?.participationId && user
      ? { participationId: mine.participationId, name: user.name }
      : undefined,
  );
  const maxDistance = splitDistance(summary?.maxDistanceMeter ?? 0);
  const myDistance = splitDistance(mine?.distance ?? 0);

  return (
    <main className="page-container marathon-status">
      <header className="status-head">
        <div>
          <h1 id="statusPageTitle">대회 현황</h1>
          <p className="status-head__desc">
            독서일지 승인 및 서평 확인 결과에 따라 인정 거리가 반영됩니다.
          </p>
        </div>
        {events.length > 0 && (
          <div className="status-head__side">
            <div className="status-course-filter">
              <label htmlFor="statusEventFilter">행사</label>
              <select
                id="statusEventFilter"
                value={event?.eventId ?? chosenEventId ?? ''}
                disabled={isLoading}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  selectEvent('public', id);
                  setChosenEventId(id);
                  setMine(null);
                  setPersonalError('');
                  setEvent(null);
                  setUpdatedAt(null);
                  setCourses([]);
                  setSelectedCourseId(undefined);
                  setLoadState('initial');
                }}
              >
                {events.map((item) => (
                  <option key={item.eventId} value={item.eventId}>
                    {getEventDisplayTitle(item)}
                  </option>
                ))}
              </select>
            </div>
            {updatedAt && (
              // 서버가 집계 시각을 주지 않아, 화면이 서버에서 최신 순위를 받아 온 시각을 보여 줍니다.
              <p className="status-updated">
                <time dateTime={updatedAt.toISOString()}>
                  {formatKoDateTime24(updatedAt.toISOString())} 기준
                </time>
              </p>
            )}
          </div>
        )}
      </header>

      {isMine && mine?.participationId && (
        <section className="status-mine" aria-labelledby="statusMineTitle">
          <h2 id="statusMineTitle">내 순위</h2>
          <dl className="status-stats">
            <div>
              <dt>참가 코스 순위</dt>
              <dd>
                {mine.rank ? <Figure value={mine.rank.toLocaleString()} unit="위" /> : '집계 전'}
              </dd>
            </div>
            <div>
              <dt>일지 승인 쪽수</dt>
              <dd>
                <Figure value={mine.pages.toLocaleString()} unit="쪽" />
              </dd>
            </div>
            <div>
              <dt>거리 인정 쪽수</dt>
              <dd>
                <Figure value={getCreditedPages(mine.distance).toLocaleString()} unit="쪽" />
              </dd>
            </div>
            <div>
              <dt>인정 거리</dt>
              <dd>
                <Figure value={myDistance.value} unit={myDistance.unit} />
              </dd>
            </div>
          </dl>
        </section>
      )}
      {isAuthenticated && personalError && (
        <p className="status-note" role="status">
          {personalError}
        </p>
      )}

      <section className="status-ranking-section" aria-labelledby="statusRankingTitle">
        <div className="section-row">
          <h2 id="statusRankingTitle">참가자 현황</h2>
          <div className="status-course-filter">
            <label htmlFor={COURSE_FILTER_ID}>코스</label>
            <select
              id={COURSE_FILTER_ID}
              value={selectedCourseId ?? ''}
              disabled={!event || loadState === 'initial'}
              onChange={(changeEvent) =>
                void handleCourseChange(
                  changeEvent.target.value ? Number(changeEvent.target.value) : undefined,
                )
              }
            >
              <option value="">전체 코스</option>
              {courses.map((course) => (
                <option key={course.courseId} value={course.courseId}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 선택한 코스 기준의 참고 통계(기록이 없는 참가자 포함, 완주자는 코스 목표 거리 달성, 거리는 일지 승인과 서평 확인을 마친 거리) */}
        <dl className="status-totals" aria-describedby="statusTotalsNote">
          <div>
            <dt>총 참가자</dt>
            <dd>{isReady ? `${(summary?.participantCount ?? 0).toLocaleString()}명` : '—'}</dd>
          </div>
          <div>
            <dt>완주자</dt>
            <dd>{isReady ? `${(summary?.completedCount ?? 0).toLocaleString()}명` : '—'}</dd>
          </div>
          <div>
            <dt>최고 누적 거리</dt>
            <dd>{isReady ? `${maxDistance.value}${maxDistance.unit ?? ''}` : '—'}</dd>
          </div>
        </dl>
        <p id="statusTotalsNote" className="sr-only">
          선택한 코스 기준이며 기록이 없는 참가자를 포함합니다. 완주자는 코스 목표 거리를 달성한
          참가자, 최고 누적 거리는 일지 승인과 서평 확인을 마친 거리입니다.
        </p>

        <div aria-live="polite" aria-busy={isLoading}>
          {loadState === 'initial' ? (
            <ContentSkeleton variant="table" label="대회 현황을 불러오고 있습니다." />
          ) : loadState === 'empty' ? (
            <div className="ranking-empty">공개된 대회 현황이 없습니다.</div>
          ) : loadState === 'error' ? (
            <div className="ranking-empty is-error">{errorMessage}</div>
          ) : (
            <RankingBoard
              rankings={displayedRankings}
              eventStatus={event?.status}
              simpleLayout
              myParticipationId={isMine ? mine?.participationId : undefined}
            />
          )}
        </div>
      </section>
    </main>
  );
}

export default MarathonStatusPage;
