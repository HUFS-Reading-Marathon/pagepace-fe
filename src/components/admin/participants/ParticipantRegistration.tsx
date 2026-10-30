import { useEffect, useState, type FormEvent } from "react";
import {
  getAdminUsers,
  createAdminUser,
  getAdminParticipations,
  registerParticipant,
  type AdminUser,
  type AdminParticipation,
} from "../../../api/adminParticipationApi";
import { getAdminEventCourses } from "../../../api/adminEventApi";
import { getEventSummary, type EventSummary } from "../../../api/eventApi";
import type { AdminCourse } from "../../../types/adminEvent";

export default function ParticipantRegistration({
  eventId,
}: {
  eventId: number;
}) {
  const [selectedParticipant, setSelectedParticipant] =
    useState<AdminParticipation>();
  const [participantSearch, setParticipantSearch] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [participants, setParticipants] = useState<AdminParticipation[]>([]);
  const [summary, setSummary] = useState<EventSummary>();
  const [userId, setUserId] = useState(0);
  const [courseId, setCourseId] = useState(0);
  const [search, setSearch] = useState("");
  const [newAccount, setNewAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    studentNo: "",
    email: "",
    phone: "",
    department: "",
    affiliationType: "UNDERGRADUATE",
    password: "",
  });
  useEffect(() => {
    let active = true;
    Promise.all([
      getAdminUsers(),
      getAdminEventCourses(eventId),
      getAdminParticipations(eventId),
      getEventSummary(eventId, undefined, true),
    ])
      .then(([u, c, p, s]) => {
        if (active) {
          setUsers(u);
          setCourses(c);
          setParticipants(p);
          setSummary(s);
        }
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, [eventId]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !courseId || (!newAccount && !userId)) return;
    const selected = users.find((user) => user.userId === userId);
    if (
      !window.confirm(
        `${newAccount ? form.name : selected?.name}님을 선택한 코스에 등록할까요?`,
      )
    )
      return;
    setBusy(true);
    setMessage("");
    let created = false;
    try {
      let targetId = userId;
      if (newAccount) {
        const user = await createAdminUser(form);
        targetId = user.userId;
        created = true;
        setUsers((previous) => [...previous, user]);
        setUserId(targetId);
        setNewAccount(false);
        setForm((previous) => ({ ...previous, password: "" }));
      }
      await registerParticipant(eventId, courseId, targetId);
      setMessage("참가자를 등록했습니다.");
      try {
        const [p, s] = await Promise.all([
          getAdminParticipations(eventId),
          getEventSummary(eventId, undefined, true),
        ]);
        setParticipants(p);
        setSummary(s);
      } catch {
        setMessage(
          "등록은 완료했지만 목록 갱신에 실패했습니다. 페이지를 새로고침해 주세요.",
        );
      }
    } catch (error) {
      setMessage(
        `${created ? "계정은 생성되었습니다. 선택된 계정으로 등록을 재시도해 주세요. " : ""}${error instanceof Error ? error.message : "등록하지 못했습니다."}`,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="admin-event-settings__panel registration-panel">
      <h2>참가 현황</h2>
      <p>
        {summary
          ? `실제 참가자 ${summary.participantCount}명 · 완주 ${summary.completedCount}명 (취소·실격 제외)`
          : "참가 현황 조회 중"}
      </p>
      {message && <p role="status">{message}</p>}
      <details className="registration-create">
        <summary>참가자 등록</summary>
        <form className="registration-form" onSubmit={submit}>
          <fieldset disabled={busy}>
            <label>
              <input
                type="checkbox"
                checked={newAccount}
                onChange={(e) => setNewAccount(e.target.checked)}
              />{" "}
              새 사용자 계정도 생성
            </label>
            {newAccount ? (
              <>
                {(
                  [
                    "name",
                    "studentNo",
                    "email",
                    "phone",
                    "department",
                    "password",
                  ] as const
                ).map((field) => (
                  <label key={field}>
                    {
                      {
                        name: "이름",
                        studentNo: "학번/교번/사번",
                        email: "이메일",
                        phone: "연락처",
                        department: "학과/부서",
                        password: "초기 비밀번호",
                      }[field]
                    }
                    <input
                      required={["name", "studentNo", "password"].includes(
                        field,
                      )}
                      type={
                        field === "password"
                          ? "password"
                          : field === "email"
                            ? "email"
                            : "text"
                      }
                      minLength={field === "password" ? 8 : undefined}
                      value={form[field]}
                      onChange={(e) =>
                        setForm({ ...form, [field]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <label>
                  신분
                  <select
                    value={form.affiliationType}
                    onChange={(e) =>
                      setForm({ ...form, affiliationType: e.target.value })
                    }
                  >
                    <option value="UNDERGRADUATE">학부생</option>
                    <option value="GRADUATE">대학원생</option>
                    <option value="PROFESSOR">교수</option>
                    <option value="STAFF">직원</option>
                    <option value="OTHER">기타</option>
                  </select>
                </label>
                <p>
                  계정 생성과 참가 등록은 별도 처리입니다. 참가 등록에 실패해도
                  생성된 계정은 유지됩니다.
                </p>
              </>
            ) : (
              <>
                <label>
                  사용자 검색
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="이름 또는 학번"
                  />
                </label>
                <label>
                  등록할 사용자
                  <select
                    required
                    value={userId || ""}
                    onChange={(e) => setUserId(Number(e.target.value))}
                  >
                    <option value="">선택</option>
                    {users
                      .filter(
                        (user) =>
                          user.active &&
                          user.status === "ACTIVE" &&
                          (`${user.name} ${user.studentNo}`.includes(search) ||
                            user.userId === userId),
                      )
                      .map((user) => (
                        <option key={user.userId} value={user.userId}>
                          {user.name} · {user.studentNo}
                        </option>
                      ))}
                  </select>
                </label>
              </>
            )}
            <label>
              등록할 코스
              <select
                required
                value={courseId || ""}
                onChange={(e) => setCourseId(Number(e.target.value))}
              >
                <option value="">선택</option>
                {courses
                  .filter((course) => course.active !== false)
                  .map((course) => (
                    <option key={course.courseId} value={course.courseId}>
                      {course.name}
                    </option>
                  ))}
              </select>
            </label>
            <button disabled={busy}>{busy ? "등록 중…" : "참가자 등록"}</button>
          </fieldset>
        </form>
      </details>
      <div
        className={
          selectedParticipant
            ? "ux-split registration-workspace"
            : "registration-workspace"
        }
      >
        <section className="registration-records">
          <h3>참가 기록 <span>{participants.length}건</span></h3>
          <label>
            참가자 검색{" "}
            <input
              placeholder="이름 또는 학번"
              value={participantSearch}
              onChange={(e) => setParticipantSearch(e.target.value)}
            />
          </label>
          <div className="table-scroll">
            <table className="registration-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>학번</th>
                  <th>코스</th>
                  <th>상태</th>
                  <th>승인 쪽수</th>
                  <th>인정 거리</th>
                  <th>상세</th>
                </tr>
              </thead>
              <tbody>
                {participants
                  .filter((p) =>
                    `${p.name} ${p.studentNo}`.includes(participantSearch),
                  )
                  .map((p) => (
                    <tr key={p.participationId}>
                      <td>{p.name}</td>
                      <td>{p.studentNo}</td>
                      <td>{p.courseName}</td>
                      <td>
                        {{
                          APPROVED: "참가 중",
                          COMPLETED: "완주",
                          CANCELLED: "취소",
                          DISQUALIFIED: "실격",
                        }[p.status] ?? p.status}
                      </td>
                      <td>{p.totalPages}</td>
                      <td>{(p.totalDistanceMeter / 1000).toFixed(2)}km</td>
                      <td>
                        <button onClick={() => setSelectedParticipant(p)}>
                          상세 보기
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
        {selectedParticipant && (
          <aside
            className="ux-detail registration-detail"
            aria-label="참가자 상세"
          >
            <div className="ux-section-heading">
              <h3>{selectedParticipant.name}</h3>
              <button
                onClick={() => setSelectedParticipant(undefined)}
                aria-label="참가자 상세 닫기"
              >
                닫기
              </button>
            </div>
            <p>
              {selectedParticipant.studentNo} ·{" "}
              {selectedParticipant.department || "소속 미등록"}
            </p>
            <p>참가 코스: {selectedParticipant.courseName}</p>
            <dl>
              <div>
                <dt>승인 쪽수</dt>
                <dd>{selectedParticipant.totalPages}쪽</dd>
              </div>
              <div>
                <dt>인정 거리</dt>
                <dd>{selectedParticipant.totalDistanceMeter}m</dd>
              </div>
            </dl>
            <p>완주일: {selectedParticipant.completedAt || "미완주"}</p>
            <p className="ux-muted">
              참가 신청서와 실제 참가 기록은 별도로 관리됩니다.
            </p>
          </aside>
        )}
      </div>
    </section>
  );
}
