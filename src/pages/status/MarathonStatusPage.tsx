import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '../../api/apiClient';
import { getCurrentEvent, getEventCourses, type EventCourse } from '../../api/eventApi';
import { getRankings, type Ranking } from '../../api/rankingApi';
import './status.css';

const STATUS_ERROR_MESSAGE = '대회 현황을 불러오지 못했습니다.';

function MarathonStatusPage() {
  const [eventId, setEventId] = useState<number | null>(null);
  const [courses, setCourses] = useState<EventCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | undefined>();
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    getCurrentEvent()
      .then(async (event) => {
        setEventId(event.eventId);
        const [nextCourses, nextRankings] = await Promise.all([
          getEventCourses(event.eventId),
          getRankings(event.eventId),
        ]);
        setCourses(nextCourses);
        setRankings(nextRankings);
      })
      .catch((error: unknown) => setErrorMessage(getApiErrorMessage(error, STATUS_ERROR_MESSAGE)))
      .finally(() => setIsLoading(false));
  }, []);

  const handleCourseChange = async (courseId?: number) => {
    if (!eventId) return;
    setSelectedCourseId(courseId);
    setIsLoading(true);
    try {
      setRankings(await getRankings(eventId, courseId));
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, STATUS_ERROR_MESSAGE));
    } finally {
      setIsLoading(false);
    }
  };

  const completedCount = rankings.filter((ranking) => ranking.progressPercent >= 100).length;
  const maxDistance = Math.max(0, ...rankings.map((ranking) => ranking.distance));

  return (
    <main className="page-container">
      <section className="page-section">
        <p className="page-label">Marathon Status</p>
        <h1>대회 현황</h1>
        <p className="page-description">
          승인된 독서일지를 기준으로 집계된 순위입니다. 개인정보는 일부 마스킹됩니다.
        </p>
      </section>
      <section className="status-grid">
        <article className="status-card">
          <span>총 참가자</span>
          <strong>{rankings.length}명</strong>
          <p>현재 선택 조건 기준</p>
        </article>
        <article className="status-card">
          <span>완주자</span>
          <strong>{completedCount}명</strong>
          <p>코스 목표 거리를 달성한 참가자</p>
        </article>
        <article className="status-card">
          <span>최고 누적 거리</span>
          <strong>{(maxDistance / 1000).toFixed(2)}km</strong>
          <p>승인된 페이지 기준</p>
        </article>
      </section>
      <section className="table-section">
        <div className="section-row">
          <h2>참가자 현황</h2>
          <select
            value={selectedCourseId ?? ''}
            onChange={(event) =>
              handleCourseChange(event.target.value ? Number(event.target.value) : undefined)
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
        {isLoading ? (
          <p>대회 현황을 불러오고 있습니다.</p>
        ) : errorMessage ? (
          <p>{errorMessage}</p>
        ) : (
          <div className="table-scroll official-card">
            <table className="program-table">
              <thead>
                <tr>
                  <th>순위</th>
                  <th>이름</th>
                  <th>학번</th>
                  <th>누적 페이지</th>
                  <th>누적 거리</th>
                  <th>완주율</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((ranking) => (
                  <tr key={`${ranking.rank}-${ranking.studentNo}`}>
                    <td>{ranking.rank}</td>
                    <td>{ranking.name}</td>
                    <td>{ranking.studentNo}</td>
                    <td>{ranking.approvedPages.toLocaleString()}쪽</td>
                    <td>{(ranking.distance / 1000).toFixed(2)}km</td>
                    <td>{Math.min(ranking.progressPercent, 100).toFixed(1)}%</td>
                    <td>{ranking.progressPercent >= 100 ? '완주' : '진행중'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default MarathonStatusPage;
