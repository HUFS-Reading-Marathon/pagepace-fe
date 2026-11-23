import { preferredAdminEvent } from '../../utils/eventSelection';
import { useAdminEventState } from '../../hooks/useAdminEventState';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getApiErrorMessage } from '../../api/apiClient';
import { getAdminEventCourses, getAdminEvents } from '../../api/adminEventApi';
import { getAdminRankings, type Ranking } from '../../api/rankingApi';
import AdminPageTabs from '../../components/admin/AdminPageTabs';
import { COMPETITION_TABS } from '../../constants/adminNavigation';
import RankingBoard from '../../components/ranking/RankingBoard';
import type { AdminCourse, AdminEvent } from '../../types/adminEvent';
import {
  ADMIN_COMPETITION_SORT_OPTIONS,
  type AdminCompetitionSortOption,
} from '../../types/adminStatus';
import { formatStatusDistance, sortCompetitionStandings } from '../../utils/statusAggregation';
import '../../styles/ranking.css';

const RANKING_ERROR_MESSAGE = '관리자 랭킹을 불러오지 못했습니다.';

function AdminRankingPage() {
  const sequence = useRef(0);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventId, setEventId] = useAdminEventState();
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [courseId, setCourseId] = useState<number | undefined>();
  const [sort, setSort] = useState<AdminCompetitionSortOption>('distance-desc');
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminEvents()
      .then((nextEvents) => {
        setEvents(nextEvents);
        setEventId(preferredAdminEvent(nextEvents)?.eventId ?? null);
        if (nextEvents.length === 0) setIsLoading(false);
      })
      .catch((requestError: unknown) => {
        setError(getApiErrorMessage(requestError, '행사를 불러오지 못했습니다.'));
        setIsLoading(false);
      });
  }, [setEventId]);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    let active = true;
    const request = ++sequence.current;
    Promise.all([getAdminEventCourses(eventId), getAdminRankings(eventId)])
      .then(([nextCourses, nextRankings]) => {
        if (!active || sequence.current !== request) return;

        setCourses(nextCourses);
        setCourseId(undefined);
        setSort('distance-desc');
        setRankings(nextRankings);
        setError('');
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(getApiErrorMessage(requestError, RANKING_ERROR_MESSAGE));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [eventId]);
  const filterCourse = async (nextCourseId: number | undefined) => {
    if (!eventId) return;
    const request = ++sequence.current;

    setCourseId(nextCourseId);
    setIsLoading(true);

    try {
      const rows = await getAdminRankings(eventId, nextCourseId);
      if (sequence.current === request) {
        setRankings(rows);
        setError('');
      }
    } catch (error) {
      if (sequence.current === request)
        setError(error instanceof Error ? error.message : '조회 실패');
    } finally {
      if (sequence.current === request) setIsLoading(false);
    }
  };
  const orderedRankings = useMemo(
    () =>
      sortCompetitionStandings(
        rankings,
        sort,
        (row) => row.distance,
        (row) => row.approvedPages,
      ),
    [rankings, sort],
  );
  const leaders = rankings.filter((row) => row.rank === 1);

  const selectedEvent = events.find((event) => event.eventId === eventId);

  return (
    <section className="admin-page admin-ranking ranking-page is-admin">
      <header className="admin-page__header ranking-admin-header">
        <div>
          <h1>대회 현황·랭킹</h1>
        </div>
        <div className="ranking-admin-summary">
          <span>
            {courseId === undefined
              ? '전체 코스'
              : courses.find((course) => course.courseId === courseId)?.name}{' '}
            · 최고 인정 거리
          </span>
          <strong>
            {isLoading || error || !leaders.length
              ? '—'
              : formatStatusDistance(leaders[0].distance)}
          </strong>
          {!isLoading && !error && leaders.length > 0 && (
            <small>
              {leaders.length === 1 ? `1위 ${leaders[0].name}` : `공동 1위 ${leaders.length}명`}
            </small>
          )}
        </div>
      </header>
      <AdminPageTabs label="대회 현황·랭킹 화면" tabs={COMPETITION_TABS} />
      <section className="ranking-toolbar is-admin">
        <label>
          <span>관리 행사</span>
          <select
            value={eventId ?? ''}
            onChange={(event) => {
              ++sequence.current;
              setCourses([]);
              setRankings([]);
              setIsLoading(true);
              setEventId(Number(event.target.value));
            }}
          >
            {events.map((event) => (
              <option key={event.eventId} value={event.eventId}>
                {event.roundNo}회 · {event.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>코스</span>
          <select
            value={courseId ?? ''}
            onChange={(event) =>
              void filterCourse(event.target.value ? Number(event.target.value) : undefined)
            }
          >
            <option value="">전체 코스</option>
            {courses.map((course) => (
              <option key={course.courseId} value={course.courseId}>
                {course.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>정렬</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as AdminCompetitionSortOption)}
          >
            {ADMIN_COMPETITION_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div>
          <strong>{selectedEvent?.title ?? '행사 선택'}</strong>
          <span>
            {isLoading ? '조회 중…' : error ? '조회 실패' : `참가자 ${rankings.length}명`}
          </span>
        </div>
      </section>
      {isLoading ? (
        <div className="ranking-empty">랭킹을 집계하고 있습니다.</div>
      ) : error ? (
        <div className="ranking-empty is-error">{error}</div>
      ) : (
        <RankingBoard rankings={orderedRankings} eventStatus={selectedEvent?.status} showIdentity />
      )}
    </section>
  );
}

export default AdminRankingPage;
