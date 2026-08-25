import { useEffect, useState } from 'react';
import { ApiError } from '../../api/apiClient';
import { getCurrentEvent, getEventCourses, type CurrentEvent, type EventCourse } from '../../api/eventApi';
import { getCurrentParticipation } from '../../api/participationApi';
import { getRankings, type Ranking } from '../../api/rankingApi';
import RankingBoard from '../../components/ranking/RankingBoard';
import '../../styles/ranking.css';

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
      } catch (requestError: unknown) {
        setError(requestError instanceof ApiError ? requestError.message : '랭킹을 불러오지 못했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    void loadRanking();
  }, []);

  const changeCourse = async (nextCourseId?: number) => { if (!event) return; setCourseId(nextCourseId); setIsLoading(true); try { setRankings(await getRankings(event.eventId, nextCourseId)); setUpdatedAt(new Date()); setError(''); } catch (requestError) { setError(requestError instanceof ApiError ? requestError.message : '랭킹을 불러오지 못했습니다.'); } finally { setIsLoading(false); } };

  return <main className="ranking-page"><section className="ranking-hero"><div><p>READING MARATHON RANKING</p><h1>독서마라톤 랭킹</h1><span>{event ? `${event.roundNo}회 ${event.title}` : '승인된 독서 기록으로 집계된 순위입니다.'}</span></div><div className="ranking-privacy"><strong>개인정보 보호</strong><span>이름과 학번 일부가 마스킹되어 표시됩니다.</span>{updatedAt && <time>업데이트 {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(updatedAt)}</time>}</div></section><section className="ranking-toolbar"><div><strong>코스별 순위</strong><span>목표가 다른 코스끼리 구분해서 확인해 보세요.</span></div><select value={courseId ?? ''} onChange={(changeEvent) => void changeCourse(changeEvent.target.value ? Number(changeEvent.target.value) : undefined)}><option value="">전체 코스</option>{courses.map((course) => <option key={course.courseId} value={course.courseId}>{course.name}</option>)}</select></section>{isLoading ? <div className="ranking-empty">랭킹을 집계하고 있습니다.</div> : error ? <div className="ranking-empty is-error">{error}</div> : <RankingBoard rankings={rankings} simpleLayout />}</main>;
}

export default RankingPage;
