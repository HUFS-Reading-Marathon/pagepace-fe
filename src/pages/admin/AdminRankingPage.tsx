import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '../../api/apiClient';
import { getAdminEventCourses, getAdminEvents } from '../../api/adminEventApi';
import { getAdminRankings, type Ranking, type RankingSort } from '../../api/rankingApi';
import RankingBoard from '../../components/ranking/RankingBoard';
import type { AdminCourse, AdminEvent } from '../../types/adminEvent';
import '../../styles/ranking.css';

const RANKING_ERROR_MESSAGE = '관리자 랭킹을 불러오지 못했습니다.';

function AdminRankingPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventId, setEventId] = useState<number | null>(null);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [courseId, setCourseId] = useState<number | undefined>();
  const [sort, setSort] = useState<RankingSort>('RANK');
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminEvents()
      .then((nextEvents) => {
        setEvents(nextEvents);
        setEventId(
          nextEvents.find((event) => ['IN_PROGRESS', 'APPLICATION_OPEN'].includes(event.status))
            ?.eventId ??
            nextEvents[0]?.eventId ??
            null,
        );

        if (nextEvents.length === 0) {
          setIsLoading(false);
        }
      })
      .catch((requestError: unknown) => {
        setError(getApiErrorMessage(requestError, '행사를 불러오지 못했습니다.'));
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    let active = true;

    Promise.all([getAdminEventCourses(eventId), getAdminRankings(eventId)])
      .then(([nextCourses, nextRankings]) => {
        if (!active) {
          return;
        }

        setCourses(nextCourses);
        setCourseId(undefined);
        setSort('RANK');
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

  const reloadRankings = async (nextCourseId: number | undefined, nextSort: RankingSort) => {
    if (!eventId) {
      return;
    }

    setIsLoading(true);

    try {
      setRankings(await getAdminRankings(eventId, nextCourseId, nextSort));
      setError('');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, RANKING_ERROR_MESSAGE));
    } finally {
      setIsLoading(false);
    }
  };

  const filterCourse = (nextCourseId?: number) => {
    if (!eventId) {
      return;
    }

    setCourseId(nextCourseId);
    void reloadRankings(nextCourseId, sort);
  };

  const changeSort = (nextSort: RankingSort) => {
    if (!eventId) {
      return;
    }

    setSort(nextSort);
    void reloadRankings(courseId, nextSort);
  };

  const selectedEvent = events.find((event) => event.eventId === eventId);

  return (
    <section className="admin-page admin-ranking ranking-page is-admin">
      <header className="admin-page__header ranking-admin-header">
        <div>
          <h1>참가자 랭킹</h1>
          <p>마스킹되지 않은 참가자 정보와 코스별 진행 순위를 확인합니다.</p>
        </div>
        <div className="ranking-admin-summary">
          <span>현재 1위</span>
          <strong>{rankings[0]?.name ?? '-'}</strong>
          <small>{rankings[0] ? `${(rankings[0].distance / 1000).toFixed(2)}km` : '집계 전'}</small>
        </div>
      </header>
      <section className="ranking-toolbar is-admin">
        <label>
          <span>행사</span>
          <select
            value={eventId ?? ''}
            onChange={(event) => {
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
              filterCourse(event.target.value ? Number(event.target.value) : undefined)
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
          <select value={sort} onChange={(event) => changeSort(event.target.value as RankingSort)}>
            <option value="RANK">거리 순</option>
            <option value="NAME">이름 순</option>
          </select>
        </label>
        <div>
          <strong>{selectedEvent?.title ?? '행사 선택'}</strong>
          <span>총 {rankings.length}명</span>
        </div>
      </section>
      {isLoading ? (
        <div className="ranking-empty">랭킹을 집계하고 있습니다.</div>
      ) : error ? (
        <div className="ranking-empty is-error">{error}</div>
      ) : (
        <RankingBoard rankings={rankings} showIdentity />
      )}
    </section>
  );
}

export default AdminRankingPage;
