import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '../../api/apiClient';
import {
  getCurrentEvent,
  getEventCourses,
  type CurrentEvent,
  type EventCourse,
} from '../../api/eventApi';
import { getCurrentParticipation } from '../../api/participationApi';
import { getRankings, type Ranking } from '../../api/rankingApi';
import RankingBoard from '../../components/ranking/RankingBoard';
import '../../styles/ranking.css';

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

function RankingPage() {
  const [event, setEvent] = useState<CurrentEvent | null>(null);
  const [courses, setCourses] = useState<EventCourse[]>([]);
  const [courseId, setCourseId] = useState<number | undefined>();
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    const loadRanking = async () => {
      try {
        let nextEvent: CurrentEvent;

        try {
          const participation = await getCurrentParticipation();

          nextEvent = {
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
          nextEvent = await getCurrentEvent();
        }

        const [nextCourses, nextRankings] = await Promise.all([
          getEventCourses(nextEvent.eventId),
          getRankings(nextEvent.eventId),
        ]);

        setEvent(nextEvent);
        setCourses(nextCourses);
        setRankings(nextRankings);
        setUpdatedAt(new Date());
        setError('');
      } catch (requestError: unknown) {
        setError(getApiErrorMessage(requestError, '랭킹을 불러오지 못했습니다.'));
      } finally {
        setIsLoading(false);
      }
    };

    void loadRanking();
  }, []);

  const changeCourse = async (nextCourseId?: number) => {
    if (!event) return;

    setCourseId(nextCourseId);
    setIsLoading(true);

    try {
      const nextRankings = await getRankings(event.eventId, nextCourseId);

      setRankings(nextRankings);
      setUpdatedAt(new Date());
      setError('');
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError, '랭킹을 불러오지 못했습니다.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="ranking-page">
      <section className="ranking-hero">
        <div>
          <p>READING MARATHON RANKING</p>

          <h1>독서마라톤 랭킹</h1>

          <span>
            {event ? getEventDisplayTitle(event) : '승인된 독서 기록으로 집계된 순위입니다.'}
          </span>

          <small className="ranking-privacy">
            ※ 개인정보 보호를 위해 이름과 학번 일부가 마스킹되어 표시됩니다.
            {updatedAt && (
              <time>
                {' '}
                · 업데이트{' '}
                {new Intl.DateTimeFormat('ko-KR', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(updatedAt)}
              </time>
            )}
          </small>
        </div>
      </section>

      <section className="ranking-toolbar">
        <div>
          <strong>코스별 순위</strong>
          <span>목표가 다른 코스끼리 구분해서 확인해 보세요.</span>
        </div>

        <select
          value={courseId ?? ''}
          onChange={(changeEvent) =>
            void changeCourse(
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
      </section>

      {isLoading ? (
        <div className="ranking-empty">랭킹을 집계하고 있습니다.</div>
      ) : error ? (
        <div className="ranking-empty is-error">{error}</div>
      ) : (
        <RankingBoard rankings={rankings} simpleLayout />
      )}
    </main>
  );
}

export default RankingPage;
