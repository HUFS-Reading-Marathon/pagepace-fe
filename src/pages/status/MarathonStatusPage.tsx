import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth";
import {
  getCurrentEvent,
  getPublicEvents,
  getEventCourses,
  getEventSummary,
  type CurrentEvent,
  type EventCourse,
  type EventSummary,
} from "../../api/eventApi";
import { getRankings, type Ranking } from "../../api/rankingApi";
import { getMyParticipations } from "../../api/participationApi";
import type { MyParticipation } from "../../types/participation";
import { selectEvent, selectedEventId } from "../../utils/eventSelection";
import RankingBoard, {
  RaceProgress,
} from "../../components/ranking/RankingBoard";
import "./status.css";

export default function MarathonStatusPage() {
  const { isAuthenticated, user } = useAuth();
  const [events, setEvents] = useState<CurrentEvent[]>([]);
  const [eventId, setEventId] = useState<number>();
  const [courseId, setCourseId] = useState<number>();
  const [courses, setCourses] = useState<EventCourse[]>([]);
  const [data, setData] = useState<{
    summary: EventSummary;
    rankings: Ranking[];
  } | null>(null);
  const [mine, setMine] = useState<{
    owner: number;
    rows: MyParticipation[];
  } | null>(null);
  const [personalError, setPersonalError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([getPublicEvents(), getCurrentEvent()])
      .then(([list, current]) => {
        if (active) {
          setEvents(list);
          setEventId(
            list.find((item) => item.eventId === selectedEventId("public"))
              ?.eventId ?? current.eventId,
          );
        }
      })
      .catch((error) => {
        if (active) {
          setError(error.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!eventId) return;
    let active = true;
    Promise.all([
      getEventCourses(eventId),
      getEventSummary(eventId, courseId),
      getRankings(eventId, courseId),
    ])
      .then(([nextCourses, summary, rankings]) => {
        if (active) {
          setCourses(nextCourses);
          setData({ summary, rankings });
          setError("");
        }
      })
      .catch((error) => {
        if (active) {
          setData(null);
          setError(error.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventId, courseId, refresh]);
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let active = true;
    getMyParticipations()
      .then((rows) => {
        if (active) {
          setMine({ owner: user.userId, rows });
          setPersonalError("");
        }
      })
      .catch(() => {
        if (active)
          setPersonalError(
            "내 참가 정보를 불러오지 못했습니다. 새로고침해 주세요.",
          );
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, user, refresh]);
  const participation =
    isAuthenticated && mine?.owner === user?.userId
      ? mine?.rows.find(
          (p) =>
            p.eventId === eventId &&
            ["APPROVED", "COMPLETED"].includes(p.participationStatus),
        )
      : undefined;
  const myRank =
    participation &&
    data?.rankings.find(
      (r) => r.participationId === participation.participationId,
    );
  const changeEvent = (id: number) => {
    selectEvent("public", id);
    setEventId(id);
    setCourseId(undefined);
    setData(null);
    setCourses([]);
    setLoading(true);
  };
  return (
    <main className="page-container marathon-ranking">
      <header className="page-section">
        <p className="page-label">한국외대 도서관 독서마라톤</p>
        <h1>대회 현황 · 랭킹</h1>
        <p>함께 읽고, 각자의 완주를 향해 나아갑니다.</p>
      </header>
      <div className="race-toolbar">
        <label>
          행사
          <select
            value={eventId ?? ""}
            onChange={(e) => changeEvent(Number(e.target.value))}
          >
            {events.map((e) => (
              <option key={e.eventId} value={e.eventId}>
                {e.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          코스
          <select
            value={courseId ?? ""}
            disabled={loading}
            onChange={(e) => {
              setCourseId(Number(e.target.value) || undefined);
              setData(null);
              setLoading(true);
            }}
          >
            <option value="">전체 코스</option>
            {courses.map((c) => (
              <option key={c.courseId} value={c.courseId}>
                {c.name} · 목표 {c.targetDistanceMeter.toLocaleString()}m
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setRefresh((v) => v + 1);
          }}
        >
          새로고침
        </button>
      </div>
      {loading ? (
        <p role="status">랭킹을 불러오고 있습니다.</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : (
        data && (
          <>
            <section
              className="race-metrics"
              aria-label="선택한 행사와 코스의 집계"
            >
              <div>
                <span>참가자</span>
                <strong>{data.summary.participantCount}명</strong>
              </div>
              <div>
                <span>완주자</span>
                <strong>{data.summary.completedCount}명</strong>
              </div>
              <div>
                <span>인정 거리 합계</span>
                <strong>
                  {data.summary.verifiedDistanceMeter.toLocaleString()}m
                </strong>
              </div>
              <small>
                {courseId ? "선택한 코스" : "행사 전체"} 기준 · 취소·실격 제외
              </small>
            </section>
            {isAuthenticated && (
              <section className="my-race" aria-label="나의 순위">
                <div>
                  <span>
                    나의 순위 · {courseId ? "선택 코스" : "행사 전체"} 기준
                  </span>
                  <h2>
                    {myRank
                      ? `${myRank.rank}위`
                      : participation
                        ? courseId && participation.courseId !== courseId
                          ? "다른 코스에 참가 중"
                          : "첫 일지 승인 후 집계"
                        : personalError
                          ? "조회 실패"
                          : mine?.owner === user?.userId
                            ? "참가 기록 없음"
                            : "참가 정보 조회 중"}
                  </h2>
                  <p>{personalError || participation?.courseName}</p>
                </div>
                {participation && (
                  <div className="my-race-progress">
                    <strong>
                      인정 거리{" "}
                      {participation.totalDistanceMeter.toLocaleString()}m
                    </strong>
                    <RaceProgress
                      percent={
                        participation.targetDistanceMeter
                          ? (participation.totalDistanceMeter /
                              participation.targetDistanceMeter) *
                            100
                          : 0
                      }
                    />
                    <p>
                      승인 {participation.totalPages.toLocaleString()}쪽 · 목표{" "}
                      {participation.targetDistanceMeter.toLocaleString()}m
                    </p>
                  </div>
                )}
                <Link to="/my">나의 독서 현황 →</Link>
              </section>
            )}
            <div className="ux-policy">
              승인 쪽수는 독서일지 승인 기준, 인정 거리는 서평 확인 기준입니다.
              트랙은 각 코스의 목표 거리 대비 진행률입니다.
            </div>
            <section>
              <div className="ux-section-heading">
                <h2>
                  {courseId
                    ? courses.find((c) => c.courseId === courseId)?.name
                    : "전체 참가자"}{" "}
                  랭킹
                </h2>
                <span>인정 거리순 · {data.rankings.length}명</span>
              </div>
              <RankingBoard
                rankings={data.rankings}
                myParticipationId={participation?.participationId}
              />
              <p className="ux-muted">
                조회 시점 기준입니다. 최신 결과는 새로고침해 주세요. 같은 거리는
                이름순으로 표시합니다.
              </p>
            </section>
          </>
        )
      )}
    </main>
  );
}
