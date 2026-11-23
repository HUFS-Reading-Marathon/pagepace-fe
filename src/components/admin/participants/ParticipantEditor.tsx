import { useEffect, useRef, useState, type ComponentPropsWithoutRef, type FormEvent } from 'react';
import { ApiError } from '../../../api/apiClient';
import { ROSTER_STATUSES, type RosterRow } from '../../../api/adminRosterApi';
import {
  addRosterParticipant,
  lookupRosterAccount,
  updateRosterParticipant,
  type RegistrationLookup,
  type ParticipantProfile,
} from '../../../api/participantEditorApi';
import {
  ADMIN_APPLICATION_AFFILIATION_LABELS,
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
  onClose: () => void;
  onSaved: (message: string) => void;
};

function EditorTextInput(props: ComponentPropsWithoutRef<'input'> & { value: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [clipped, setClipped] = useState(false);
  useEffect(() => {
    const current = input.current;
    if (!current) return;
    const observer = new ResizeObserver(() => {
      setClipped(current.scrollWidth > current.clientWidth + 1);
    });
    observer.observe(current);
    return () => observer.disconnect();
  }, [props.value]);
  return (
    <>
      <input {...props} ref={input} />
      {clipped && props.value && (
        <span className="participant-editor__full-value" aria-hidden="true">
          {props.value}
        </span>
      )}
    </>
  );
}

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
  onClose,
  onSaved,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [lookup, setLookup] = useState<RegistrationLookup | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const lookupInput = useRef<HTMLInputElement>(null);
  const lookupRequest = useRef<AbortController | null>(null);
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const existing = lookup?.state === 'EXISTING' ? lookup.user : null;
  const canRegister = !!participant || lookup?.state === 'NEW' || !!existing;
  const status = lookup?.participationStatus ?? lookup?.applicationStatus;
  const reportAvailable = !existing || !!existing.email?.trim();
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
  useEffect(() => {
    const panel = dialog.current;
    if (!panel) return;
    const trigger = document.activeElement;
    panel.showModal();
    const initialFocus = lookupInput.current ?? title.current;
    initialFocus?.focus({ preventScroll: true });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      lookupRequest.current?.abort();
      panel.close();
      document.body.style.overflow = previousOverflow;
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, []);

  function changeStudentNo(value: string) {
    lookupRequest.current?.abort();
    setLookingUp(false);
    setStudentNo(value);
    setLookup(null);
    setProfile(initialProfile());
    setCourseId(0);
    setReport({ college: '', grade: '', gender: '' });
    setPassword('');
    setShowPassword(false);
    setError('');
  }

  async function searchAccount() {
    const number = studentNo.trim();
    if (!number || busy || lookingUp || lookup) return;
    const request = new AbortController();
    lookupRequest.current = request;
    setLookingUp(true);
    setError('');
    try {
      const result = await lookupRosterAccount(eventId, number, request.signal);
      if (request.signal.aborted) return;
      setStudentNo(result.studentNo);
      setLookup(result);
      if (result.state === 'EXISTING' && result.user.email?.trim()) {
        setReport({
          college:
            result.user.college ?? findDepartmentGroup(result.user.department ?? '')?.label ?? '',
          grade: result.user.grade ?? '',
          gender: result.user.gender ?? '',
        });
      }
    } catch (err) {
      if (!request.signal.aborted)
        setError(err instanceof Error ? err.message : '회원을 조회하지 못했습니다.');
    } finally {
      if (!request.signal.aborted) setLookingUp(false);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !courseId || !canRegister) return;
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
        await addRosterParticipant({
          eventId,
          courseId,
          userId: existing.userId,
          college: report.college.trim() || undefined,
          grade: report.grade.trim() || undefined,
          gender: report.gender || undefined,
        });
      } else if (lookup?.state === 'NEW') {
        await addRosterParticipant({
          eventId,
          courseId,
          ...report,
          college: report.college.trim(),
          newUser: { ...personal, studentNo: lookup.studentNo, initialPassword: password },
        });
      }
    } catch (e) {
      if (
        !participant &&
        e instanceof ApiError &&
        [
          'STUDENT_NO_DUPLICATE',
          'PARTICIPATION_DUPLICATE',
          'APPLICATION_EXISTS',
          'USER_INACTIVE',
        ].includes(e.code ?? '')
      ) {
        changeStudentNo(studentNo);
        lookupInput.current?.focus();
      }
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
      setBusy(false);
      return;
    }
    onSaved(participant ? '참가자 정보를 수정했습니다.' : '참가자를 추가했습니다.');
  }

  return (
    <dialog
      ref={dialog}
      className={participant ? 'participant-editor participant-editor--edit' : 'participant-editor'}
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
          <h2 id="participant-editor-title" ref={title} tabIndex={-1}>
            {participant ? '참가자 정보 수정' : '참가자 추가'}
          </h2>
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
            <div className="participant-editor__lookup">
              <label htmlFor="roster-lookup-number">학번·교번·사번</label>
              <div className="participant-editor__lookup-input">
                <input
                  id="roster-lookup-number"
                  ref={lookupInput}
                  value={studentNo}
                  maxLength={30}
                  autoComplete="off"
                  disabled={busy}
                  onChange={(e) => changeStudentNo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void searchAccount();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={busy || lookingUp || !studentNo.trim() || !!lookup}
                  onClick={() => void searchAccount()}
                >
                  {lookingUp ? '조회 중…' : '조회'}
                </button>
              </div>
              {lookup && (
                <p className="participant-editor__lookup-result" role="status">
                  {lookup.state === 'NEW' &&
                    '등록된 회원이 없습니다. 새 계정 정보를 입력해 주세요.'}
                  {lookup.state === 'EXISTING' && '기존 회원 정보를 불러왔습니다.'}
                  {lookup.state === 'INACTIVE' && '이 계정은 참가 등록을 할 수 없습니다.'}
                  {lookup.state === 'ALREADY_REGISTERED' &&
                    '이 행사에 이미 신청 또는 등록한 학번입니다.' +
                      (status ? ' 현재 상태는 ' + ROSTER_STATUSES[status] + '입니다.' : '')}
                </p>
              )}
            </div>
          )}
          {existing && (
            <section className="participant-editor__member" aria-label="회원 정보">
              <h3>회원 정보</h3>
              <dl>
                {[
                  ['이름', existing.name],
                  ['이메일', existing.email],
                  ['연락처', existing.phone],
                  ['신분', ADMIN_APPLICATION_AFFILIATION_LABELS[existing.affiliationType]],
                  ['학과·부서', existing.department],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value || '—'}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {canRegister && (
            <fieldset className="participant-editor__fields" disabled={busy}>
              {!existing && (
                <>
                  <label>
                    이름
                    <EditorTextInput
                      required
                      maxLength={50}
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    />
                  </label>
                  {participant && (
                    <label>
                      학번·교번·사번
                      <EditorTextInput value={participant.studentNo} readOnly />
                    </label>
                  )}
                  <label className="participant-editor__email">
                    이메일
                    <EditorTextInput
                      type="email"
                      required
                      maxLength={100}
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    />
                  </label>
                  <label className="participant-editor__phone">
                    연락처
                    <EditorTextInput
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
                    <EditorTextInput
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
                </>
              )}
              {reportAvailable && (
                <>
                  <label>
                    단과대학
                    <EditorTextInput
                      maxLength={100}
                      value={report.college}
                      onChange={(e) => setReport({ ...report, college: e.target.value })}
                    />
                  </label>
                  <label>
                    학년
                    <EditorTextInput
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
          )}
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
          {canRegister && (
            <button type="submit" className="participant-editor__submit" disabled={busy}>
              {busy ? '저장 중…' : participant ? '저장' : '참가자 추가'}
            </button>
          )}
        </footer>
      </form>
    </dialog>
  );
}
