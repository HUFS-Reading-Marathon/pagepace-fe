import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { getAdminUsers, type AdminUser } from '../../../api/adminParticipationApi';
import type { RosterRow } from '../../../api/adminRosterApi';
import {
  addRosterParticipant,
  updateRosterParticipant,
  type ParticipantProfile,
} from '../../../api/participantEditorApi';
import {
  ADMIN_APPLICATION_AFFILIATION_OPTIONS,
  type AdminApplicationAffiliationType,
} from '../../../types/adminApplication';
import type { AdminCourse } from '../../../types/adminEvent';
import { findDepartmentGroup } from '../../../constants/departments';
import './participant-editor.css';

type Props = {
  eventId: number;
  courses: AdminCourse[];
  participant?: RosterRow | null;
  courseChangesAllowed?: boolean;
  registeredStudentNos?: readonly string[];
  onClose: () => void;
  onSaved: (message: string) => void;
};

function initialProfile(row?: RosterRow | null): ParticipantProfile {
  return {
    name: row?.name ?? '',
    email: row?.email ?? '',
    phone: row?.phone ?? '',
    department: row?.department ?? '',
    affiliationType: row?.affiliationType ?? 'UNDERGRADUATE',
  };
}

export default function ParticipantEditor({
  eventId,
  courses,
  participant,
  courseChangesAllowed = true,
  registeredStudentNos,
  onClose,
  onSaved,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [accountMode, setAccountMode] = useState<'new' | 'existing'>('new');
  const [profile, setProfile] = useState(() => initialProfile(participant));
  const [studentNo, setStudentNo] = useState(participant?.studentNo ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [courseId, setCourseId] = useState(participant?.courseId ?? 0);
  const [report, setReport] = useState({
    college: participant?.college ?? '',
    grade: participant?.grade ?? '',
    gender: participant?.gender ?? '',
  });
  const [query, setQuery] = useState('');
  const [userId, setUserId] = useState(0);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [userLoadError, setUserLoadError] = useState('');
  const [userLoadAttempt, setUserLoadAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const existing = !participant && accountMode === 'existing';
  const currentCourse = courses.find((c) => c.courseId === participant?.courseId);
  const courseOptions = courses.filter((course) => {
    if (course.courseId === participant?.courseId) return true;
    if (course.active === false) return false;
    if (!participant) return true;
    if (!courseChangesAllowed) return false;
    return (
      !participant.participationId ||
      (!!currentCourse && course.targetDistanceMeter > currentCourse.targetDistanceMeter)
    );
  });
  const enrolled = useMemo(() => new Set(registeredStudentNos), [registeredStudentNos]);
  const normalizedQuery = query.trim().toLowerCase();
  const userOptions = (users ?? []).filter(
    (user) =>
      user.active &&
      user.status === 'ACTIVE' &&
      !enrolled.has(user.studentNo) &&
      (user.name + ' ' + user.studentNo).toLowerCase().includes(normalizedQuery),
  );

  useEffect(() => {
    const panel = dialog.current;
    if (!panel) return;
    const trigger = document.activeElement;
    panel.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      panel.close();
      document.body.style.overflow = previousOverflow;
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, []);

  useEffect(() => {
    if (!existing || users !== null) return;
    let subscribed = true;
    getAdminUsers()
      .then((result) => {
        if (subscribed) setUsers(result);
      })
      .catch((e: unknown) => {
        if (subscribed)
          setUserLoadError(e instanceof Error ? e.message : '회원 목록을 불러오지 못했습니다.');
      });
    return () => {
      subscribed = false;
    };
  }, [existing, userLoadAttempt, users]);

  function changeMode(next: 'new' | 'existing') {
    setAccountMode(next);
    setError('');
    setUserLoadError('');
    setPassword('');
    setShowPassword(false);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !courseId) return;
    if (
      !participant &&
      !existing &&
      (!password.trim() || password.length < 8 || new TextEncoder().encode(password).length > 72)
    ) {
      setError('초기 비밀번호는 8자 이상, UTF-8 기준 72바이트 이내로 입력해 주세요.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const personal = {
        ...profile,
        name: profile.name.trim(),
        email: profile.email.trim(),
        phone: profile.phone.trim(),
        department: profile.department.trim(),
      };
      if (participant) {
        const id = participant.participationId ?? participant.applicationId;
        if (!id) throw new Error('수정할 참가자를 찾을 수 없습니다.');
        await updateRosterParticipant(
          participant.participationId ? 'participations' : 'applications',
          id,
          {
            ...personal,
            courseId,
            ...report,
            college: report.college.trim(),
          },
        );
      } else if (existing) {
        await addRosterParticipant({ eventId, courseId, userId });
      } else {
        await addRosterParticipant({
          eventId,
          courseId,
          ...report,
          college: report.college.trim(),
          newUser: { ...personal, studentNo: studentNo.trim(), initialPassword: password },
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
      setBusy(false);
      return;
    }
    onSaved(participant ? '참가자 정보를 수정했습니다.' : '참가자를 추가했습니다.');
  }

  return (
    <dialog
      ref={dialog}
      className="participant-editor"
      aria-labelledby="participant-editor-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget || busy) return;
        const bounds = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < bounds.left ||
          e.clientX > bounds.right ||
          e.clientY < bounds.top ||
          e.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <form className="participant-editor__form" onSubmit={submit} aria-busy={busy}>
        <header className="participant-editor__header">
          <h2 id="participant-editor-title">{participant ? '참가자 정보 수정' : '참가자 추가'}</h2>
          <button
            type="button"
            className="participant-editor__close"
            onClick={onClose}
            disabled={busy}
            aria-label="닫기"
          >
            ×
          </button>
        </header>
        <div className="participant-editor__body">
          {!participant && (
            <fieldset className="participant-editor__modes" disabled={busy}>
              <legend>계정 선택</legend>
              <label>
                <input
                  type="radio"
                  checked={accountMode === 'new'}
                  name="participant-account-mode"
                  onChange={() => changeMode('new')}
                />
                새 계정 만들기
              </label>
              <label>
                <input
                  type="radio"
                  checked={accountMode === 'existing'}
                  name="participant-account-mode"
                  onChange={() => changeMode('existing')}
                />
                기존 회원 등록
              </label>
            </fieldset>
          )}
          <fieldset className="participant-editor__fields" disabled={busy}>
            {existing ? (
              <>
                <label className="participant-editor__wide">
                  회원 검색
                  <input
                    type="search"
                    value={query}
                    placeholder="이름 또는 학번·사번"
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setUserId(0);
                    }}
                  />
                </label>
                <label className="participant-editor__wide">
                  등록할 회원
                  <select
                    required
                    value={userId || ''}
                    onChange={(e) => setUserId(Number(e.target.value))}
                  >
                    <option value="">
                      {users === null
                        ? userLoadError
                          ? '회원 목록을 확인할 수 없음'
                          : '회원 목록 불러오는 중'
                        : userOptions.length
                          ? '회원 선택'
                          : '등록 가능한 검색 결과 없음'}
                    </option>
                    {userOptions.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.name} · {u.studentNo}
                      </option>
                    ))}
                  </select>
                </label>
                {userLoadError && (
                  <div className="participant-editor__error participant-editor__wide" role="alert">
                    {userLoadError}{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setUserLoadError('');
                        setUserLoadAttempt((n) => n + 1);
                      }}
                    >
                      다시 불러오기
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <label>
                  이름
                  <input
                    required
                    maxLength={50}
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  />
                </label>
                <label>
                  학번·교번·사번
                  <input
                    required
                    value={studentNo}
                    readOnly={!!participant}
                    autoComplete="off"
                    maxLength={30}
                    onChange={(e) => setStudentNo(e.target.value)}
                  />
                </label>
                <label>
                  이메일
                  <input
                    type="email"
                    required
                    maxLength={100}
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  />
                </label>
                <label>
                  연락처
                  <input
                    type="tel"
                    maxLength={30}
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  />
                </label>
                <label>
                  신분
                  <select
                    value={profile.affiliationType}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        affiliationType: e.target.value as AdminApplicationAffiliationType,
                      })
                    }
                  >
                    {ADMIN_APPLICATION_AFFILIATION_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  학과·부서
                  <input
                    maxLength={100}
                    value={profile.department}
                    onChange={(e) => {
                      const department = e.target.value;
                      const previousGroup = findDepartmentGroup(profile.department)?.label;
                      setProfile({ ...profile, department });
                      if (!report.college || report.college === previousGroup)
                        setReport({
                          ...report,
                          college: findDepartmentGroup(department)?.label ?? '',
                        });
                    }}
                  />
                </label>
                <label>
                  단과대학
                  <input
                    maxLength={100}
                    value={report.college}
                    onChange={(e) => setReport({ ...report, college: e.target.value })}
                  />
                </label>
                <label>
                  학년
                  <input
                    maxLength={16}
                    value={report.grade}
                    onChange={(e) => setReport({ ...report, grade: e.target.value })}
                  />
                </label>
                <label>
                  성별
                  <select
                    value={report.gender}
                    onChange={(e) => setReport({ ...report, gender: e.target.value })}
                  >
                    <option value="">미입력</option>
                    {report.gender && !['여', '남'].includes(report.gender) && (
                      <option>{report.gender}</option>
                    )}
                    <option>여</option>
                    <option>남</option>
                  </select>
                </label>
              </>
            )}
            <label className={existing ? 'participant-editor__wide' : undefined}>
              참가 코스
              <select
                required
                disabled={!!participant && !courseChangesAllowed}
                value={courseId || ''}
                onChange={(e) => setCourseId(Number(e.target.value))}
              >
                <option value="">코스 선택</option>
                {participant?.courseId && !currentCourse && (
                  <option value={participant.courseId}>
                    {participant.courseName || '현재 코스'}
                  </option>
                )}
                {courseOptions.map((c) => (
                  <option key={c.courseId} value={c.courseId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {!participant && !existing && (
              <div className="participant-editor__wide participant-editor__password">
                <label htmlFor="roster-initial-password">초기 비밀번호</label>
                <div className="participant-editor__password-control">
                  <input
                    id="roster-initial-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    aria-describedby="participant-password-hint"
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? '숨김' : '표시'}
                  </button>
                </div>
                <small id="participant-password-hint">
                  참가자가 첫 로그인에 사용할 비밀번호를 8자 이상 입력해 주세요.
                </small>
              </div>
            )}
          </fieldset>
        </div>
        {error && (
          <p className="participant-editor__error participant-editor__submit-error" role="alert">
            {error}
          </p>
        )}
        <footer className="participant-editor__footer">
          <button type="button" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button
            type="submit"
            className="participant-editor__submit"
            disabled={busy || (existing && !userId)}
          >
            {busy ? '저장 중…' : participant ? '저장' : '참가자 추가'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
