import { ROSTER_STATUSES } from '../../../api/adminRosterApi';
import { ADMIN_APPLICATION_AFFILIATION_OPTIONS } from '../../../types/adminApplication';
import type { AdminCourse } from '../../../types/adminEvent';

import { DEFAULT_FILTERS, type RosterFilters } from '../../../utils/participantRoster';

type Props = {
  filters: RosterFilters;
  courses: AdminCourse[];
  onChange: (filters: RosterFilters) => void;
};

export default function ParticipantFilters({ filters, courses, onChange }: Props) {
  const update = (key: keyof RosterFilters, value: string) =>
    onChange({ ...filters, [key]: value });
  // 이전 명단의 상세 상태를 저장한 링크로 들어오면 그 조건을 그대로 표시한다.
  const linkedStatus = Object.entries(ROSTER_STATUSES).find(
    ([key]) => filters.status === key && key !== 'APPLIED',
  );
  return (
    <div className="roster-filters" role="search" aria-label="참가자 명단 검색">
      <input
        type="search"
        aria-label="검색"
        placeholder="이름, 학번, 소속, 연락처 검색"
        value={filters.query}
        onChange={(e) => update('query', e.target.value)}
      />
      <label>
        상태
        <select
          aria-label="상태"
          value={filters.status}
          onChange={(e) => update('status', e.target.value)}
        >
          <option value="PARTICIPANTS">승인 참가자</option>
          <option value="APPLIED">승인 대기</option>
          <option value="">전체</option>
          {linkedStatus && (
            <option value={linkedStatus[0]}>
              {linkedStatus[0] === 'APPROVED' ? '참가 중' : linkedStatus[1]}
            </option>
          )}
        </select>
      </label>
      <label>
        코스
        <select
          aria-label="코스"
          value={filters.course}
          onChange={(e) => update('course', e.target.value)}
        >
          <option value="">전체</option>
          {courses.map((c) => (
            <option key={c.courseId} value={String(c.courseId)}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        신분
        <select
          aria-label="신분"
          value={filters.affiliation}
          onChange={(e) => update('affiliation', e.target.value)}
        >
          <option value="">전체</option>
          {ADMIN_APPLICATION_AFFILIATION_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button
        className="roster-link"
        type="button"
        disabled={
          !filters.query &&
          !filters.course &&
          !filters.affiliation &&
          filters.status === DEFAULT_FILTERS.status
        }
        onClick={() => onChange(DEFAULT_FILTERS)}
      >
        초기화
      </button>
    </div>
  );
}
