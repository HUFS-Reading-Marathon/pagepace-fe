import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  createAdminNotice,
  deleteAdminNotice,
  getAdminNotices,
  updateAdminNotice,
  type Notice,
} from "../../api/noticeApi";
import "../../styles/admin-notices.css";
const EMPTY = { title: "", content: "", pinned: false, visible: false };
export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = async () => {
    const rows = await getAdminNotices();
    setNotices(rows);
  };
  useEffect(() => {
    let active = true;
    getAdminNotices()
      .then((rows) => {
        if (active) setNotices(rows);
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
  }, []);
  const dirty =
    open &&
    JSON.stringify(form) !==
      JSON.stringify(
        editing
          ? {
              title: editing.title,
              content: editing.content,
              pinned: editing.pinned,
              visible: editing.visible,
            }
          : EMPTY,
      );
  const start = (notice?: Notice) => {
    if (dirty && !window.confirm("저장하지 않은 변경사항을 버리고 이동할까요?"))
      return;
    setEditing(notice ?? null);
    setForm(
      notice
        ? {
            title: notice.title,
            content: notice.content,
            pinned: notice.pinned,
            visible: notice.visible,
          }
        : EMPTY,
    );
    setOpen(true);
    setPreview(false);
    setError("");
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy.current) return;
    if (!form.title.trim() || !form.content.trim()) {
      setPreview(false);
      setError("제목과 내용을 입력해 주세요.");
      return;
    }
    if (
      form.visible &&
      !window.confirm("이 공지를 모든 방문자에게 게시할까요?")
    )
      return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      if (editing) await updateAdminNotice(editing.noticeId, form);
      else await createAdminNotice(form);
      setOpen(false);
      setEditing(null);
      setForm(EMPTY);
      setMessage(
        form.visible ? "공지를 게시했습니다." : "비공개로 저장했습니다.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const remove = async (n: Notice) => {
    if (busy.current || !window.confirm(`“${n.title}” 공지를 삭제할까요?`))
      return;
    busy.current = true;
    setSaving(true);
    try {
      await deleteAdminNotice(n.noticeId);
      if (editing?.noticeId === n.noticeId) {
        setOpen(false);
        setEditing(null);
        setForm(EMPTY);
      }
      await load();
      setMessage("공지를 삭제했습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 실패");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const rows = notices.filter(
    (n) =>
      (filter === "all" || (filter === "visible") === n.visible) &&
      `${n.title} ${n.content}`.includes(search),
  );
  return (
    <section className="admin-page admin-notices">
      <header className="admin-page__header">
        <div>
          <h1>공지사항 관리</h1>
          <p>공지사항은 행사 구분 없이 모든 방문자에게 표시됩니다.</p>
        </div>
        <button disabled={saving} onClick={() => start()}>
          + 공지 작성
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      <p role="status">{message}</p>
      <div className="ux-tabs" role="tablist" aria-label="공지 상태">
        {[
          ["all", "전체"],
          ["visible", "게시 중"],
          ["hidden", "비공개"],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="admin-notices__layout">
        <section className="admin-notices__list">
          <label>
            공지 검색
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="제목 또는 내용"
            />
          </label>
          {loading ? (
            <p>불러오는 중입니다.</p>
          ) : rows.length ? (
            rows.map((n) => (
              <article
                key={n.noticeId}
                aria-current={editing?.noticeId === n.noticeId}
              >
                <div>
                  <strong>
                    {n.pinned ? "[중요] " : ""}
                    {n.title}
                  </strong>
                  <small>
                    {n.visible ? "게시 중" : "비공개"} ·{" "}
                    {new Date(n.updatedAt).toLocaleDateString("ko-KR")}
                  </small>
                </div>
                <div>
                  <button disabled={saving} onClick={() => start(n)}>
                    편집
                  </button>
                  <button disabled={saving} onClick={() => void remove(n)}>
                    삭제
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p>해당하는 공지가 없습니다.</p>
          )}
        </section>
        {open ? (
          <form className="admin-notices__form" noValidate onSubmit={submit}>
            <fieldset disabled={saving}>
              <h2>{editing ? "공지 수정" : "새 공지"}</h2>
              <div className="ux-tabs">
                <button
                  type="button"
                  aria-pressed={!preview}
                  onClick={() => setPreview(false)}
                >
                  편집
                </button>
                <button
                  type="button"
                  aria-pressed={preview}
                  onClick={() => setPreview(true)}
                >
                  미리보기
                </button>
              </div>
              <div hidden={preview}>
                <label>
                  제목
                  <input
                    required
                    maxLength={200}
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                  />
                </label>
                <label>
                  내용
                  <textarea
                    required
                    rows={10}
                    value={form.content}
                    onChange={(e) =>
                      setForm({ ...form, content: e.target.value })
                    }
                  />
                </label>
              </div>
              {preview && (
                <article className="admin-notices__preview">
                  <h3>{form.title || "제목 없음"}</h3>
                  {form.content || "내용을 입력해 주세요."}
                </article>
              )}
              <div className="admin-notices__checks">
                <label>
                  <input
                    type="checkbox"
                    checked={form.pinned}
                    onChange={(e) =>
                      setForm({ ...form, pinned: e.target.checked })
                    }
                  />{" "}
                  중요 공지
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.visible}
                    onChange={(e) =>
                      setForm({ ...form, visible: e.target.checked })
                    }
                  />{" "}
                  모든 방문자에게 게시
                </label>
              </div>
              <p className="ux-muted">
                자동 저장되지 않습니다. 게시를 선택하지 않으면 비공개로
                저장합니다.
              </p>
              <div className="ux-actions">
                <button
                  type="button"
                  onClick={() => {
                    if (!dirty || window.confirm("변경사항을 버릴까요?"))
                      setOpen(false);
                  }}
                >
                  취소
                </button>
                <button type="submit">
                  {saving
                    ? "저장 중…"
                    : form.visible
                      ? "게시 내용 확인 후 저장"
                      : "비공개로 저장"}
                </button>
              </div>
            </fieldset>
          </form>
        ) : (
          <div className="ux-detail">
            <h2>공지를 선택해 주세요</h2>
            <p>
              목록에서 편집하거나 새 공지를 작성할 수 있습니다. 게시 전에
              미리보기로 확인해 주세요.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
