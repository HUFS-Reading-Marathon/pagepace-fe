import { preferredAdminEvent } from "../../utils/eventSelection";
import { useAdminEventState } from "../../hooks/useAdminEventState";
import { useEffect, useRef, useState } from "react";
import { getAdminEvents } from "../../api/adminEventApi";
import {
  getAdminReviewTargets,
  verifyAdminReview,
  type AdminReviewTarget,
} from "../../api/adminReadingLogApi";
import type { AdminEvent } from "../../types/adminEvent";
import "../../styles/admin-reviews.css";

export default function AdminReviewsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventId, setEventId] = useAdminEventState();
  const [targets, setTargets] = useState<AdminReviewTarget[]>([]);
  const [selected, setSelected] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [checked, setChecked] = useState(false);
  const [search, setSearch] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    getAdminEvents()
      .then((next) => {
        if (active) {
          setEvents(next);
          setEventId(preferredAdminEvent(next)?.eventId ?? null);
          if (!next.length) setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [setEventId]);
  useEffect(() => {
    if (!eventId) return;
    let active = true;
    getAdminReviewTargets(eventId)
      .then((next) => {
        if (active) {
          setTargets(next);
          setSelected(next[0]?.participantBookId);
          setChecked(false);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventId, refresh]);
  const filtered = targets.filter((t) =>
    `${t.userName} ${t.studentNo} ${t.bookTitle}`.includes(search),
  );
  const target = filtered.find((t) => t.participantBookId === selected);
  const verify = async () => {
    if (!target || !checked || busyRef.current) return;
    if (
      !window.confirm(
        `${target.userName} · ${target.bookTitle}\n이번 인정 ${target.distanceToCreditMeter / 5}쪽, +${target.distanceToCreditMeter}m를 반영할까요?`,
      )
    )
      return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await verifyAdminReview(target.participantBookId);
      const remaining = targets.filter(
        (t) => t.participantBookId !== target.participantBookId,
      );
      setTargets(remaining);
      setSelected(
        remaining.filter((t) =>
          `${t.userName} ${t.studentNo} ${t.bookTitle}`.includes(search),
        )[0]?.participantBookId,
      );
      setChecked(false);
      setMessage(
        `${target.userName}님의 서평을 확인하고 ${target.distanceToCreditMeter}m를 반영했습니다.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "거리 반영에 실패했습니다.");
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };
  return (
    <section className="admin-page admin-reviews">
      <header className="admin-page__header">
        <div>
          <h1>서평 확인</h1>
          <p>도서관 작성 기록을 확인한 후, 이번 독서량만 거리로 반영합니다.</p>
        </div>
        <label>
          행사
          <select
            disabled={busy}
            value={eventId ?? ""}
            onChange={(e) => {
              setTargets([]);
              setSelected(undefined);
              setChecked(false);
              setLoading(true);
              setMessage("");
              setEventId(Number(e.target.value));
            }}
          >
            {events.map((e) => (
              <option key={e.eventId} value={e.eventId}>
                {e.title}
              </option>
            ))}
          </select>
        </label>
      </header>
      <p className="ux-form-note">
        서평 원문은 글로벌캠퍼스 도서관에 있습니다. 작성 완료 알림은 자동 인증이
        아닙니다. 도서관 원문 또는 솔라스 추출 자료로 작성자·도서·작성일을
        대조해 주세요.
      </p>
      <div className="ux-section-heading">
        <h2>확인 대기 {loading ? "—" : targets.length}건</h2>
        <button
          disabled={busy || loading}
          onClick={() => {
            setLoading(true);
            setRefresh((v) => v + 1);
          }}
        >
          새로고침
        </button>
      </div>
      <label>
        대상 검색{" "}
        <input
          placeholder="이름, 학번, 도서명"
          value={search}
          disabled={busy}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelected(undefined);
            setChecked(false);
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <p role="status">{message}</p>
      {loading ? (
        <p role="status">확인 대상을 불러오고 있습니다.</p>
      ) : (
        <div className="ux-split">
          <div className="ux-list">
            {filtered.length ? (
              filtered.map((t) => (
                <button
                  key={t.participantBookId}
                  disabled={busy}
                  aria-pressed={selected === t.participantBookId}
                  onClick={() => {
                    setSelected(t.participantBookId);
                    setChecked(false);
                  }}
                >
                  <strong>
                    {t.userName} · {t.studentNo}
                  </strong>
                  <span>{t.bookTitle}</span>
                  <small>
                    추가 인정 대상 {t.distanceToCreditMeter / 5}쪽 ·{" "}
                    {new Date(t.reviewSubmittedAt).toLocaleDateString("ko-KR")}
                  </small>
                </button>
              ))
            ) : (
              <p className="ux-detail">확인 대기 대상이 없습니다.</p>
            )}
          </div>
          {target ? (
            <article className="ux-detail">
              <h2>{target.bookTitle}</h2>
              <p>
                {target.userName} · {target.studentNo} ·{" "}
                {target.author || "저자 정보 없음"}
              </p>
              <dl>
                <div>
                  <dt>승인 누적</dt>
                  <dd>{target.approvedReadPages}쪽</dd>
                </div>
                <div>
                  <dt>이미 인정</dt>
                  <dd>
                    {target.approvedReadPages -
                      target.distanceToCreditMeter / 5}
                    쪽
                  </dd>
                </div>
                <div>
                  <dt>이번 인정</dt>
                  <dd>{target.distanceToCreditMeter / 5}쪽</dd>
                </div>
              </dl>
              <p className="ux-policy">
                이번에 반영할 거리{" "}
                <strong>
                  +{target.distanceToCreditMeter.toLocaleString()}m
                </strong>{" "}
                · 1쪽 = 5m
              </p>
              {target.reviewSearchUrl && (
                <a
                  href={target.reviewSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  도서관에서 작성 기록 확인 ↗
                </a>
              )}
              <p>
                이미 인정한 분량은 다시 합산하지 않습니다. 미완독 도서도 읽은
                분량의 서평을 확인할 수 있습니다.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={busy}
                  onChange={(e) => setChecked(e.target.checked)}
                />{" "}
                작성자·도서·작성일과 이번 분량의 서평을 확인했습니다.
              </label>
              <div className="ux-actions">
                <button
                  disabled={!checked || busy}
                  onClick={() => void verify()}
                >
                  {busy ? "반영 중…" : "확인하고 다음 대상 보기"}
                </button>
              </div>
            </article>
          ) : (
            <div className="ux-detail">
              왼쪽 목록에서 확인할 서평을 선택해 주세요.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
