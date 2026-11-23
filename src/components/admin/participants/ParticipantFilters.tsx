import { ROSTER_STATUSES } from '../../../api/adminRosterApi';
import { ADMIN_APPLICATION_AFFILIATION_OPTIONS } from '../../../types/adminApplication';
import type { AdminCourse } from '../../../types/adminEvent';

import { EMPTY_FILTERS, type RosterFilters } from '../../../utils/participantRoster';

type Props = {
  filters: RosterFilters;
  courses: AdminCourse[];
  onChange: (filters: RosterFilters) => void;
};

export default function ParticipantFilters({ filters, courses, onChange }: Props) {
  const update = (key: keyof RosterFilters, value: string) =>
    onChange({ ...filters, [key]: value });
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
          <option value="">전체</option>
          {Object.entries(ROSTER_STATUSES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
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
        disabled={!Object.values(filters).some(Boolean)}
        onClick={() => onChange(EMPTY_FILTERS)}
      >
        초기화
      </button>
    </div>
  );
}
