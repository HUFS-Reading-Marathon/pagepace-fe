import { useEffect, useState } from 'react';
import { useAuth } from '../../auth';
import { getMyParticipations } from '../../api/participationApi';
import type { MyParticipation } from '../../types/participation';
import { getCurrentEvent, getPublicEvents, getEventCourses, getEventSummary, type CurrentEvent, type EventCourse, type EventSummary } from '../../api/eventApi';
import { getRankings, type Ranking } from '../../api/rankingApi';
import { selectEvent, selectedEventId } from '../../utils/eventSelection';
import './status.css';

export default function MarathonStatusPage() {
  const { isAuthenticated, user } = useAuth();
  const [mine, setMine] = useState<{ owner: number; rows: MyParticipation[] } | null>(null);
  const [personalError, setPersonalError] = useState('');
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let active = true;
    getMyParticipations().then(rows => { if (active) { setMine({owner:user.userId, rows}); setPersonalError(''); } })
      .catch(() => { if (active) setPersonalError('내 참가 정보를 불러오지 못했습니다. 새로고침해 주세요.'); });
    return () => { active = false; };
  }, [isAuthenticated, user]);
  const [events,setEvents]=useState<CurrentEvent[]>([]);
  const [eventId,setEventId]=useState<number>();
  const [courseId,setCourseId]=useState<number>();
  const [courses,setCourses]=useState<EventCourse[]>([]);
  const [data,setData]=useState<{summary:EventSummary;rankings:Ranking[]} | null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    Promise.all([getPublicEvents(),getCurrentEvent()]).then(([list,current])=>{
      if(!active)return;
      setEvents(list);setEventId(list.find(item=>item.eventId===selectedEventId('public'))?.eventId ?? current.eventId);
    }).catch(error=>{if(active){setError(error.message);setLoading(false);}});
    return()=>{active=false;};
  },[]);
  useEffect(()=>{
    if(!eventId)return;
    let active=true;
    Promise.all([getEventCourses(eventId),getEventSummary(eventId,courseId),getRankings(eventId,courseId)])
      .then(([nextCourses,summary,rankings])=>{if(active){setCourses(nextCourses);setData({summary,rankings});setError('');}})
      .catch(error=>{if(active){setData(null);setError(error.message);}})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[eventId,courseId]);
  const participation = isAuthenticated && mine?.owner === user?.userId ? mine?.rows.find(p => p.eventId === eventId && ['APPROVED','COMPLETED'].includes(p.participationStatus)) : undefined;
  const myRank = data?.rankings.find(row => row.participationId === participation?.participationId);
  return <main className="page-container">
    <section className="page-section"><p className="page-label">Marathon Status</p><h1>대회 현황</h1>
      <p className="page-description">참가자 수는 기록이 없는 승인 참가자도 포함합니다. 거리는 서평 확인된 승인 쪽수 기준입니다.</p>
      <label>행사 <select aria-label="행사" value={eventId??''} onChange={e=>{const id=Number(e.target.value);selectEvent('public',id);setEventId(id);setCourseId(undefined);setCourses([]);setData(null);setLoading(true);}}>
        {events.map(event=><option key={event.eventId} value={event.eventId}>{event.title}</option>)}
      </select></label>
      <label>코스 <select aria-label="코스" value={courseId??''} disabled={loading} onChange={e=>{setCourseId(Number(e.target.value)||undefined);setData(null);setLoading(true);}}>
        <option value="">전체 코스</option>{courses.map(course=><option key={course.courseId} value={course.courseId}>{course.name}</option>)}
      </select></label>
    </section>
    {loading ? <p role="status">대회 현황을 불러오고 있습니다.</p> : error ? <p role="alert">{error}</p> : data && <>
      <section className="status-grid">
        <article className="status-card"><span>총 참가자</span><strong>{data.summary.participantCount}명</strong><p>승인·완주 참가자, 취소·실격 제외</p></article>
        <article className="status-card"><span>완주자</span><strong>{data.summary.completedCount}명</strong><p>서평 확인 거리 기준</p></article>
        <article className="status-card"><span>최고 누적 거리</span><strong>{(data.summary.maxDistanceMeter/1000).toFixed(2)}km</strong><p>서평 확인된 승인 쪽수 기준</p></article>
      </section>
      <section className="table-section"><h2>참가자 랭킹</h2>
        {isAuthenticated && <p>{personalError || (myRank ? `내 순위 ${myRank.rank}위 · 승인 ${myRank.approvedPages.toLocaleString()}쪽 · 인정 ${myRank.distance.toLocaleString()}m` : participation ? '선택한 코스에 집계된 내 순위가 없습니다.' : '이 행사의 참가 기록이 없습니다.')}</p>}<p>승인된 독서량이 있는 참가자 {data.rankings.length}명</p>
        {data.rankings.length===0 ? <p>아직 승인된 독서 기록이 없습니다.</p> : <div className="table-scroll official-card"><table className="program-table"><thead><tr><th>순위</th><th>이름</th><th>승인 쪽수</th><th>인정 거리</th><th>완주율</th></tr></thead><tbody>
          {data.rankings.map(row=><tr key={row.rank}><td>{row.rank}</td><td>{row.name}</td><td>{row.approvedPages.toLocaleString()}쪽</td><td>{(row.distance/1000).toFixed(2)}km</td><td>{Math.min(row.progressPercent,100).toFixed(1)}%</td></tr>)}
        </tbody></table></div>}
      </section>
    </>}
  </main>;
}
