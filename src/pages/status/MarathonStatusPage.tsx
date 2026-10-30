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
import { formatDistance } from '../../utils/reading';
import './status.css';

const STATUS_ERROR_MESSAGE = '대회 현황을 불러오지 못했습니다.';
const COURSE_FILTER_ID = 'statusCourseFilter';

/** initial: 첫 로딩, refreshing: 코스 변경으로 랭킹만 다시 조회 중 */
type LoadState = 'initial' | 'refreshing' | 'ready' | 'error';

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

function formatUpdatedAt(date: Date) {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
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

  const isReady = loadState === 'ready';
  const isLoading = loadState === 'initial' || loadState === 'refreshing';

  const summaryItems: [string, string, string][] = [
    ['총 참가자', isReady ? `${summary?.participantCount ?? 0}명` : '—', '현재 선택 코스 기준'],
    [
      '완주자',
      isReady ? `${summary?.completedCount ?? 0}명` : '—',
      '코스 목표 거리를 달성한 참가자',
    ],
    [
      '최고 누적 거리',
      isReady ? formatDistance(summary?.maxDistanceMeter ?? 0) : '—',
      '일지 승인과 서평 확인이 완료된 거리',
    ],
  ];

  return (
    <main className="page-container marathon-status">
      <section className="page-section" aria-labelledby="statusPageTitle">
        <p className="page-label">Marathon Status</p>
        <h1 id="statusPageTitle">대회 현황</h1>
        <p className="page-description">
          {event ? `${getEventDisplayTitle(event)} · ` : ''}일지 승인 시 쪽수가, 승인된 쪽수의 서평
          확인 시 거리가 반영됩니다. 기록이 없는 승인 참가자도 총 참가자 수에 포함합니다.
        </p>
        <p className="status-privacy">
          ※ 개인정보 보호를 위해 이름은 마스킹하고 학번은 공개하지 않습니다.
          {updatedAt && (
            <>
              {' '}
              ·{' '}
              <time dateTime={updatedAt.toISOString()}>업데이트 {formatUpdatedAt(updatedAt)}</time>
            </>
          )}
        </p>
      </section>

      <div className="status-course-filter">
        <label htmlFor="statusEventFilter">행사</label>
        <select
          id="statusEventFilter"
          value={event?.eventId ?? ''}
          disabled={isLoading}
          onChange={(e) => {
            const id = Number(e.target.value);
            selectEvent('public', id);
            setChosenEventId(id);
            setMine(null);
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
      {isAuthenticated && user && mine?.owner === user.userId && mine.participationId && (
        <section className="page-section" aria-label="내 순위">
          <h2>내 순위</h2>
          <p>
            참가 코스 기준 {mine.rank ? `${mine.rank}위` : '집계 전'} · 승인{' '}
            {mine.pages.toLocaleString()}쪽 · 인정 거리 {formatDistance(mine.distance)}
          </p>
        </section>
      )}
      {isAuthenticated && personalError && <p role="status">{personalError}</p>}
      <section className="status-grid" aria-label="현황 요약">
        {summaryItems.map(([label, value, description]) => (
          <article className="status-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <section className="status-ranking-section" aria-labelledby="statusRankingTitle">
        <div className="section-row">
          <div>
            <h2 id="statusRankingTitle">참가자 현황</h2>
            <p>코스별로 순위와 진행 상황을 확인할 수 있습니다.</p>
          </div>
          <div className="status-course-filter">
            <label htmlFor={COURSE_FILTER_ID}>코스</label>
            <select
              id={COURSE_FILTER_ID}
              value={selectedCourseId ?? ''}
              disabled={!event}
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

        <div aria-live="polite" aria-busy={isLoading}>
          {isLoading ? (
            <div className="ranking-empty">대회 현황을 불러오고 있습니다.</div>
          ) : loadState === 'error' ? (
            <div className="ranking-empty is-error">{errorMessage}</div>
          ) : (
            <RankingBoard
              rankings={rankings}
              simpleLayout
              myParticipationId={
                isAuthenticated && user && mine?.owner === user.userId
                  ? mine.participationId
                  : undefined
              }
            />
          )}
        </div>
      </section>
    </main>
  );
}

export default MarathonStatusPage;
